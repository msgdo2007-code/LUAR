"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {landingContentSchema} from "@/lib/landing-schema";

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

const referralReviewSchema=z.object({ id:z.coerce.number().int().positive(), action:z.enum(["approve","reject","flag","correct"]), reason:z.string().trim().min(5).max(500), newCode:z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8,16}$/).optional().or(z.literal("")), flags:z.string().trim().max(500).default("") });
export async function reviewReferralAction(_:MutationState,formData:FormData):Promise<MutationState>{
 const parsed=referralReviewSchema.safeParse({id:formData.get("id"),action:formData.get("action"),reason:formData.get("reason"),newCode:formData.get("newCode"),flags:formData.get("flags")});
 if(!parsed.success) return {error:"Revise a ação, o motivo e o código informado."};
 const flags=[...new Set(parsed.data.flags.split(",").map(v=>v.trim().toLowerCase()).filter(Boolean))].slice(0,10);
 const {supabase}=await requireAdmin({recentMfaSeconds:600});
 const {error}=await supabase.rpc("admin_review_referral",{p_referral_id:parsed.data.id,p_action:parsed.data.action,p_reason:parsed.data.reason,p_new_code:parsed.data.newCode||null,p_fraud_flags:flags});
 if(error) return {error:"A revisão não foi concluída. Verifique a transição e sua permissão."};
 revalidatePath("/dashboard/referrals"); revalidatePath("/dashboard/audit"); return {success:"Indicação atualizada e registrada na auditoria."};
}
export async function saveLandingDraftAction(_:MutationState,formData:FormData):Promise<MutationState>{const raw=formData.get("content");const revision=z.coerce.number().int().nonnegative().safeParse(formData.get("revision"));if(typeof raw!=="string"||raw.length>80000||!revision.success)return{error:"Conteúdo inválido."};let json:unknown;try{json=JSON.parse(raw)}catch{return{error:"O conteúdo não é um JSON válido."}}const parsed=landingContentSchema.safeParse(json);if(!parsed.success)return{error:parsed.error.issues[0]?.message||"Revise os blocos."};const{supabase}=await requireAdmin({recentMfaSeconds:600});const{error}=await supabase.rpc("admin_save_landing_draft",{p_content:parsed.data,p_expected_revision:revision.data});if(error)return{error:error.code==="40001"?"Conflito: recarregue o editor antes de salvar.":"O rascunho não foi salvo."};revalidatePath("/dashboard/landing");return{success:"Rascunho salvo com segurança."}}
export async function publishLandingAction(_:MutationState,formData:FormData):Promise<MutationState>{const parsed=z.object({revision:z.coerce.number().int().nonnegative(),summary:z.string().trim().min(3).max(200)}).safeParse({revision:formData.get("revision"),summary:formData.get("summary")});if(!parsed.success)return{error:"Informe um resumo da publicação."};const{supabase}=await requireAdmin({recentMfaSeconds:600});const{error}=await supabase.rpc("admin_publish_landing",{p_expected_revision:parsed.data.revision,p_summary:parsed.data.summary});if(error)return{error:"Não foi possível publicar. Recarregue e tente novamente."};revalidatePath("/dashboard/landing");return{success:"Landing page publicada e versionada."}}
export async function restoreLandingAction(_:MutationState,formData:FormData):Promise<MutationState>{const id=z.coerce.number().int().positive().safeParse(formData.get("versionId"));if(!id.success)return{error:"Versão inválida."};const{supabase}=await requireAdmin({recentMfaSeconds:600});const{error}=await supabase.rpc("admin_restore_landing",{p_version_id:id.data});if(error)return{error:"Não foi possível restaurar a versão."};revalidatePath("/dashboard/landing");return{success:"Versão restaurada como novo rascunho."}}
