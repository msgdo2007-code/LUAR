import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import type { AdminMetrics, AuditRow, FeedbackRow, RankingRow, ReferralHistoryRow, ReferralPage, UserPage } from "@/types/admin";
import {defaultLandingContent,landingContentSchema,type LandingContent} from "@/lib/landing-schema";

const userQuerySchema = z.object({ search: z.string().trim().max(120).default(""), status: z.enum(["all", "active", "banned", "lifetime"]).default("all"), page: z.coerce.number().int().min(1).max(100000).default(1) });

export const getMetrics = cache(async (): Promise<AdminMetrics> => {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_dashboard_metrics");
  if (error) throw new Error("Não foi possível carregar as métricas.");
  return data as AdminMetrics;
});

export async function getUsers(input: unknown): Promise<UserPage> {
  const query = userQuerySchema.parse(input);
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_list_users", { p_search: query.search, p_status: query.status, p_page: query.page, p_page_size: 20 });
  if (error) throw new Error("Não foi possível carregar os usuários.");
  return data as UserPage;
}

export async function getRankings(kind: "xp" | "balance"): Promise<RankingRow[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_rankings", { p_kind: kind, p_limit: 50 });
  if (error) throw new Error("Não foi possível carregar o ranking.");
  return (data || []) as RankingRow[];
}

export async function getFeedback(status = "all"): Promise<FeedbackRow[]> {
  const parsed = z.enum(["all", "pending", "reviewing", "approved", "rejected", "implemented"]).parse(status);
  const { supabase } = await requireAdmin();
  let query = supabase.from("admin_feedback").select("id,user_id,user_email,kind,message,rating,publish_authorized,status,admin_response,created_at,updated_at").order("created_at", { ascending: false }).limit(100);
  if (parsed !== "all") query = query.eq("status", parsed);
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar o feedback.");
  return (data || []) as FeedbackRow[];
}

export async function getAuditLogs(): Promise<AuditRow[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("admin_audit_logs").select("id,actor_user_id,action,target_type,target_id,metadata,created_at").order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error("Não foi possível carregar a auditoria.");
  return (data || []) as AuditRow[];
}

const referralQuerySchema = z.object({ search:z.string().trim().max(120).default(""), status:z.enum(["all","pending","verified","approved","rejected","cancelled"]).default("all"), page:z.coerce.number().int().min(1).max(100000).default(1), fraudOnly:z.coerce.boolean().default(false) });
export async function getReferrals(input:unknown):Promise<ReferralPage>{
  const query=referralQuerySchema.parse(input); const {supabase}=await requireAdmin();
  const {data,error}=await supabase.rpc("admin_list_referrals",{p_search:query.search,p_status:query.status,p_page:query.page,p_page_size:20,p_fraud_only:query.fraudOnly});
  if(error) throw new Error("Não foi possível carregar as indicações."); return data as ReferralPage;
}
export async function getReferralHistory(id:number):Promise<ReferralHistoryRow[]>{
  const referralId=z.number().int().positive().parse(id); const {supabase}=await requireAdmin();
  const {data,error}=await supabase.rpc("admin_referral_history",{p_referral_id:referralId});
  if(error) throw new Error("Não foi possível carregar o histórico."); return (data||[]) as ReferralHistoryRow[];
}
export async function getLandingEditor():Promise<{draft:LandingContent;published:LandingContent;draftRevision:number;publishedRevision:number;publishedAt:string|null;versions:Array<{id:number;revision:number;summary:string;created_at:string}>}>{const{supabase}=await requireAdmin();const{data,error}=await supabase.rpc("admin_get_landing_editor");if(error)throw new Error("Não foi possível carregar o editor da landing page.");const draft=landingContentSchema.safeParse(data?.draft);const published=landingContentSchema.safeParse(data?.published);return {...data,draft:draft.success?draft.data:defaultLandingContent,published:published.success?published.data:defaultLandingContent};}
