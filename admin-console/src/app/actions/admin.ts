"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

export type MutationState = { error?: string; success?: string };

const lifetimeSchema = z.object({ email: z.string().trim().email().max(254), action: z.enum(["grant", "revoke"]), confirmation: z.literal("CONFIRMAR") });
export async function setLifetimeAction(_: MutationState, formData: FormData): Promise<MutationState> {
  const parsed = lifetimeSchema.safeParse({ email: formData.get("email"), action: formData.get("action"), confirmation: formData.get("confirmation") });
  if (!parsed.success) return { error: "Confirmação inválida." };
  const { supabase } = await requireAdmin({ recentMfaSeconds: 600 });
  const { error } = await supabase.rpc("admin_set_lifetime", { p_target_email: parsed.data.email, p_action: parsed.data.action });
  if (error) return { error: "A alteração não foi concluída." };
  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard");
  return { success: parsed.data.action === "grant" ? "Vitalício concedido e auditado." : "Concessão administrativa revogada." };
}

const feedbackSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["pending", "reviewing", "approved", "rejected", "implemented"]),
  response: z.string().trim().max(1200).optional().transform(value => value || null),
});
export async function updateFeedbackAction(_: MutationState, formData: FormData): Promise<MutationState> {
  const parsed = feedbackSchema.safeParse({ id: formData.get("id"), status: formData.get("status"), response: formData.get("response") });
  if (!parsed.success) return { error: "Revise o status e a resposta." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_update_feedback", { p_id: parsed.data.id, p_status: parsed.data.status, p_response: parsed.data.response });
  if (error) return { error: "O feedback não foi atualizado." };
  revalidatePath("/dashboard/feedback");
  revalidatePath("/dashboard");
  return { success: "Feedback atualizado e registrado na auditoria." };
}
