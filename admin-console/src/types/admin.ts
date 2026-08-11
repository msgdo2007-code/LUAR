export type AdminMetrics = { totalUsers: number; dau: number; mau: number; lifetimeAccounts: number; mrrCents: number; pendingFeedback: number };
export type AdminUser = { id: string; email: string; name: string; created_at: string; last_sign_in_at: string | null; banned_until: string | null; plan: "free" | "lifetime"; lifetime_source: string; login_count: number; last_login_at: string | null; xp: number };
export type UserPage = { items: AdminUser[]; total: number; page: number; pageSize: number };
export type RankingRow = { position: number; email: string; name: string; xp: number; balance: number };
export type FeedbackStatus = "pending" | "reviewing" | "approved" | "rejected" | "implemented";
export type FeedbackRow = { id: number; user_id: string; user_email: string; kind: "suggestion" | "problem" | "review"; message: string; rating: number | null; publish_authorized: boolean; status: FeedbackStatus; admin_response: string | null; created_at: string; updated_at: string };
export type AuditRow = { id: number; actor_user_id: string; action: string; target_type: string; target_id: string; metadata: Record<string, unknown>; created_at: string };
