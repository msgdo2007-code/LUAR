import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin(requireAal2 = true) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) redirect("/login?error=access");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (requireAal2 && assurance?.currentLevel !== "aal2") redirect("/login?step=mfa");
  return { supabase, user, assurance };
}
