import { Key, ShieldCheck, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-auth";

export default async function AccountSecurityPage() {
  const { user } = await requireAdmin();
  return <section className="admin-page"><header className="admin-page-head"><div><span>IDENTIDADE ADMINISTRATIVA</span><h1>Conta e segurança</h1><p>Gerencie sua credencial sem expor informações sensíveis.</p></div><ShieldCheck size={30} weight="duotone" /></header>
    <div className="admin-account-grid"><Card><CardHeader><div className="admin-security-icon"><UserCircle weight="duotone" /></div><CardDescription>CONTA AUTORIZADA</CardDescription><CardTitle>Administrador LUAR</CardTitle></CardHeader><CardContent className="space-y-4"><div className="admin-account-email"><span>E-mail</span><b>{user.email}</b></div><div className="flex flex-wrap gap-2"><Badge>Role admin</Badge><Badge variant="outline">MFA AAL2</Badge><Badge variant="outline">RLS ativo</Badge></div><p className="text-xs leading-relaxed text-muted-foreground">A senha nunca é exibida ou registrada nos logs. Alterações exigem uma sessão administrativa validada em duas etapas.</p></CardContent></Card>
      <Card><CardHeader><div className="admin-security-icon"><Key weight="duotone" /></div><CardDescription>CREDENCIAL</CardDescription><CardTitle>Alterar senha</CardTitle></CardHeader><CardContent><ChangePasswordForm /></CardContent></Card></div>
  </section>;
}
