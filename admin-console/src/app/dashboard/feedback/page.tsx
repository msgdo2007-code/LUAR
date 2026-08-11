import Link from "next/link";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { FeedbackAction } from "@/components/admin/feedback-action";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getFeedback } from "@/lib/admin-data";
import { formatDateTime } from "@/lib/format";
import type { FeedbackStatus } from "@/types/admin";
import { cn } from "@/lib/utils";

const labels: Record<FeedbackStatus, string> = { pending: "Pendente", reviewing: "Em análise", approved: "Aprovado", rejected: "Recusado", implemented: "Implementado" };
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const raw = typeof params.status === "string" ? params.status : "all";
  const status = ["all", "pending", "reviewing", "approved", "rejected", "implemented"].includes(raw) ? raw : "all";
  const feedback = await getFeedback(status);
  return <section className="admin-page"><header className="admin-page-head"><div><span>FEEDBACK HUB</span><h1>Sugestões e avaliações</h1><p>Mensagens reais enviadas pelos usuários, com fluxo de análise e resposta.</p></div><Badge variant="outline">{feedback.length} exibidos</Badge></header>
    <div className="admin-status-filters">{[["all","Todos"],["pending","Pendentes"],["reviewing","Em análise"],["approved","Aprovados"],["rejected","Recusados"],["implemented","Implementados"]].map(([key,label])=><Link key={key} className={cn(buttonVariants({ size:"sm", variant:status===key?"default":"outline" }))} href={`/dashboard/feedback?status=${key}`}>{label}</Link>)}</div>
    <div className="admin-feedback-list">{feedback.map(item => <Card key={item.id} className="admin-feedback-card"><div className="admin-feedback-head"><div><Badge variant="secondary">{item.kind === "review" ? "Avaliação" : item.kind === "problem" ? "Problema" : "Sugestão"}</Badge><Badge variant="outline">{labels[item.status]}</Badge>{item.rating && <span className="feedback-stars"><Star weight="fill" />{item.rating}/5</span>}</div><small>{formatDateTime(item.created_at)}</small></div><blockquote>{item.message}</blockquote><footer><div><b>{item.user_email}</b><small>{item.publish_authorized ? "Autorizou publicação" : "Uso interno"}</small></div><FeedbackAction feedback={item} /></footer></Card>)}{!feedback.length && <Card className="admin-empty">Nenhum feedback neste filtro.</Card>}</div>
  </section>;
}
