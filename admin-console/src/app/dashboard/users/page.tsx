import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { LifetimeAction } from "@/components/admin/lifetime-action";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUsers } from "@/lib/admin-data";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const page = typeof params.page === "string" ? params.page : "1";
  const result = await getUsers({ search, status, page });
  const href = (next: number) => `/dashboard/users?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${next}`;
  return <section className="admin-page"><header className="admin-page-head"><div><span>GESTÃO DE ACESSO</span><h1>Usuários</h1><p>Consulte contas e gerencie concessões administrativas de Vitalício.</p></div><Badge variant="outline">{formatNumber(result.total)} contas</Badge></header>
    <Card><CardContent className="pt-6"><form className="admin-filter-row"><div className="admin-search-field"><MagnifyingGlass /><Input name="search" defaultValue={search} placeholder="Buscar por nome ou e-mail" maxLength={120} /></div><Select name="status" defaultValue={status}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Ativos</SelectItem><SelectItem value="banned">Banidos</SelectItem><SelectItem value="lifetime">Vitalícios</SelectItem></SelectContent></Select><Button type="submit">Filtrar</Button></form></CardContent></Card>
    <Card className="overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Status</TableHead><TableHead>Plano</TableHead><TableHead>XP</TableHead><TableHead>Último acesso</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{result.items.map(user => <TableRow key={user.id}><TableCell><b>{user.name || "Sem nome"}</b><small className="table-subline">{user.email}</small></TableCell><TableCell><Badge variant={user.banned_until ? "destructive" : "secondary"}>{user.banned_until ? "Banido" : "Ativo"}</Badge></TableCell><TableCell><Badge variant={user.plan === "lifetime" ? "default" : "outline"}>{user.plan === "lifetime" ? "Vitalício" : "Gratuito"}</Badge><small className="table-subline">{user.lifetime_source || "—"}</small></TableCell><TableCell>{formatNumber(user.xp)}</TableCell><TableCell>{formatDateTime(user.last_login_at || user.last_sign_in_at)}</TableCell><TableCell className="text-right"><LifetimeAction email={user.email} active={user.plan === "lifetime" && user.lifetime_source === "admin"} /></TableCell></TableRow>)}</TableBody></Table></div>{!result.items.length && <div className="admin-empty">Nenhum usuário encontrado.</div>}</Card>
    <div className="admin-pagination"><Link aria-disabled={result.page <= 1} tabIndex={result.page <= 1 ? -1 : undefined} className={cn(buttonVariants({variant:"outline"}),result.page<=1&&"pointer-events-none opacity-50")} href={result.page <= 1 ? href(1) : href(result.page - 1)}>Anterior</Link><span>Página {result.page} de {Math.max(1, Math.ceil(result.total / result.pageSize))}</span><Link aria-disabled={result.page * result.pageSize >= result.total} tabIndex={result.page * result.pageSize >= result.total ? -1 : undefined} className={cn(buttonVariants({variant:"outline"}),result.page*result.pageSize>=result.total&&"pointer-events-none opacity-50")} href={result.page * result.pageSize >= result.total ? href(result.page) : href(result.page + 1)}>Próxima</Link></div>
  </section>;
}
