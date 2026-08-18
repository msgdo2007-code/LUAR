import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AdminRequirements = { requireAal2?: boolean; recentMfaSeconds?: number };

export async function requireAdmin(requirements: boolean | AdminRequirements = true) {
  const requireAal2 = typeof requirements === "boolean" ? requirements : requirements.requireAal2 !== false;
  const recentMfaSeconds = typeof requirements === "boolean" ? 0 : Math.max(0, Math.min(requirements.recentMfaSeconds || 0, 3600));
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) redirect("/login?error=access");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (requireAal2 && assurance?.currentLevel !== "aal2") redirect("/login?step=mfa");
  if (recentMfaSeconds) {
    const { data: claimData, error: claimError } = await supabase.auth.getClaims();
    const claims = claimData?.claims as Record<string, unknown> | undefined;
    const amr = Array.isArray(claims?.amr) ? claims.amr : [];
    const newestMfa = amr
      .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
      .filter((entry) => ["totp", "mfa", "otp"].includes(String(entry.method || "").toLowerCase()))
      .reduce((latest, entry) => Math.max(latest, Number(entry.timestamp) || 0), 0);
    const now = Math.floor(Date.now() / 1000);
    if (claimError || !newestMfa || now - newestMfa > recentMfaSeconds) redirect("/login?step=mfa&reauth=1");
  }
  return { supabase, user, assurance };
}
