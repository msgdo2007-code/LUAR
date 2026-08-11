"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

export type AuthActionState = { error?: string; enrollment?: { factorId: string; qrCode?: string; secret?: string } };

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  website: z.string().max(0).optional(),
});

export async function signInAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const startedAt = Date.now();
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password"), website: formData.get("website") });
  if (!parsed.success) return { error: "Não foi possível entrar com essas credenciais." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 700 - (Date.now() - startedAt))));
    return { error: "Não foi possível entrar com essas credenciais." };
  }
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
  if (!role) {
    await supabase.auth.signOut();
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 700 - (Date.now() - startedAt))));
    return { error: "Não foi possível entrar com essas credenciais." };
  }
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  redirect(assurance?.currentLevel === "aal2" ? "/dashboard" : "/login?step=mfa");
}

export async function prepareMfaAction(): Promise<AuthActionState> {
  const { supabase } = await requireAdmin(false);
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) return { error: "Não foi possível preparar a verificação em duas etapas." };
  const verified = factors.totp.find(factor => factor.status === "verified");
  if (verified) return { enrollment: { factorId: verified.id } };
  for (const stale of factors.totp.filter(factor => factor.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: stale.id });
  const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "LUAR Admin" });
  if (enrollError) return { error: "Não foi possível ativar a verificação em duas etapas." };
  return { enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

const mfaSchema = z.object({ factorId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });

export async function verifyMfaAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = mfaSchema.safeParse({ factorId: formData.get("factorId"), code: String(formData.get("code") || "").replace(/\s/g, "") });
  if (!parsed.success) return { error: "Digite o código de seis números do autenticador." };
  const { supabase } = await requireAdmin(false);
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: parsed.data.factorId, code: parsed.data.code });
  if (error) return { error: "Código inválido ou expirado." };
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") return { error: "A verificação não pôde ser concluída." };
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
