import { Medal, Trophy } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRankings } from "@/lib/admin-data";
import { formatMoney, formatNumber } from "@/lib/format";

function RankingTable({ rows, kind }: { rows: Awaited<ReturnType<typeof getRankings>>; kind: "xp" | "balance" }) {
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Posição</TableHead><TableHead>Usuário</TableHead><TableHead className="text-right">{kind === "xp" ? "XP" : "Saldo gerenciado"}</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={`${kind}-${row.position}-${row.email}`}><TableCell><span className="rank-position">{row.position <= 3 ? <Medal weight="fill" /> : null}{row.position}º</span></TableCell><TableCell><b>{row.name || "Sem nome"}</b><small className="table-subline">{row.email}</small></TableCell><TableCell className="text-right font-semibold">{kind === "xp" ? formatNumber(row.xp) : formatMoney(row.balance)}</TableCell></TableRow>)}</TableBody></Table></div>;
}

export default async function RankingsPage() {
  const [xp, balance] = await Promise.all([getRankings("xp"), getRankings("balance")]);
  return <section className="admin-page"><header className="admin-page-head"><div><span>GAMIFICAÇÃO</span><h1>Rankings</h1><p>Comparativos calculados no servidor sem expor o estado completo das contas.</p></div><Trophy size={30} weight="duotone" /></header><div className="admin-ranking-grid"><Card><CardHeader><CardDescription>EVOLUÇÃO</CardDescription><CardTitle>Maior XP</CardTitle></CardHeader><CardContent className="p-0"><RankingTable rows={xp} kind="xp" /></CardContent></Card><Card><CardHeader><CardDescription>FINANCEIRO</CardDescription><CardTitle>Maior saldo cadastrado</CardTitle></CardHeader><CardContent className="p-0"><RankingTable rows={balance} kind="balance" /></CardContent></Card></div></section>;
}
