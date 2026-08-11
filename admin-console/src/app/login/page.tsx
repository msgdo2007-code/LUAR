import { redirect } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { LoginForm } from "@/components/auth/login-form";
import { MfaForm } from "@/components/auth/mfa-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const step = params.step;
  if (Array.isArray(step)) redirect("/login");
  const mfa = step === "mfa";
  return <main className="admin-login-shell">
    <div className="admin-login-brand"><span className="admin-mark">☾</span><div><strong>LUAR</strong><small>OPERAÇÕES SEGURAS</small></div></div>
    <Card className="admin-login-card">
      <CardHeader className="space-y-4"><div className="admin-security-icon"><ShieldCheck weight="duotone" /></div><div><CardTitle>{mfa ? "Confirme sua identidade" : "Acesso administrativo"}</CardTitle><CardDescription>{mfa ? "Use o código do autenticador para concluir o acesso." : "Área restrita a administradores autorizados."}</CardDescription></div></CardHeader>
      <CardContent>{mfa ? <MfaForm /> : <LoginForm />}</CardContent>
    </Card>
    <p className="admin-login-foot">Sessão protegida por RBAC, RLS e autenticação em duas etapas.</p>
  </main>;
}
