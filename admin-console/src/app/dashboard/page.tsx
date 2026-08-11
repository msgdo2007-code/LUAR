import { ChatCircleText, Crown, CurrencyDollar, Pulse, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMetrics } from "@/lib/admin-data";
import { formatMoney, formatNumber } from "@/lib/format";

export default async function DashboardPage() {
  const metrics = await getMetrics();
  const cards = [
    ["Usuários", formatNumber(metrics.totalUsers), "Contas registradas", UsersThree],
    ["Ativos hoje", formatNumber(metrics.dau), `${formatNumber(metrics.mau)} ativos em 30 dias`, Pulse],
    ["Vitalícios", formatNumber(metrics.lifetimeAccounts), "Acessos permanentes", Crown],
    ["MRR", formatMoney(metrics.mrrCents / 100), "LUAR vende pagamento único", CurrencyDollar],
    ["Sugestões pendentes", formatNumber(metrics.pendingFeedback), "Aguardando análise", ChatCircleText],
  ] as const;
  return <section className="admin-page"><header className="admin-page-head"><div><span>VISÃO GERAL</span><h1>Painel de operações</h1><p>Métricas reais e ações administrativas protegidas.</p></div><small>Atualizado em tempo real</small></header>
    <div className="admin-kpi-grid">{cards.map(([title, value, copy, Icon]) => <Card key={title} className="admin-kpi"><CardHeader><div className="admin-kpi-icon"><Icon weight="duotone" /></div><CardDescription>{title}</CardDescription><CardTitle>{value}</CardTitle></CardHeader><CardContent><p>{copy}</p></CardContent></Card>)}</div>
    <div className="admin-overview-grid"><Card><CardHeader><CardDescription>ENGAJAMENTO</CardDescription><CardTitle>Atividade mensal</CardTitle></CardHeader><CardContent><div className="admin-ratio"><strong>{metrics.mau ? Math.round(metrics.dau / metrics.mau * 100) : 0}%</strong><span>dos usuários ativos no mês também entraram hoje.</span></div></CardContent></Card><Card><CardHeader><CardDescription>SEGURANÇA</CardDescription><CardTitle>Camadas ativas</CardTitle></CardHeader><CardContent><ul className="admin-check-list"><li>Autorização administrativa no servidor</li><li>Sessão MFA em nível AAL2</li><li>Row Level Security no Supabase</li><li>Auditoria de ações sensíveis</li></ul></CardContent></Card></div>
  </section>;
}
