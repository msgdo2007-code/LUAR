import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuditLogs } from "@/lib/admin-data";
import { formatDateTime } from "@/lib/format";

export default async function AuditPage() {
  const logs = await getAuditLogs();
  return <section className="admin-page"><header className="admin-page-head"><div><span>RASTREABILIDADE</span><h1>Log de auditoria</h1><p>Registro somente leitura das últimas ações administrativas sensíveis.</p></div><ShieldCheck size={30} weight="duotone" /></header><Card className="overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Ação</TableHead><TableHead>Alvo</TableHead><TableHead>Administrador</TableHead><TableHead>Metadados</TableHead></TableRow></TableHeader><TableBody>{logs.map(log => <TableRow key={log.id}><TableCell>{formatDateTime(log.created_at)}</TableCell><TableCell><Badge variant="secondary">{log.action}</Badge></TableCell><TableCell><b>{log.target_type}</b><small className="table-subline">{log.target_id}</small></TableCell><TableCell className="font-mono text-xs">{log.actor_user_id}</TableCell><TableCell><code className="audit-metadata">{JSON.stringify(log.metadata)}</code></TableCell></TableRow>)}</TableBody></Table></div>{!logs.length && <div className="admin-empty">Nenhuma ação administrativa registrada.</div>}</Card></section>;
}
