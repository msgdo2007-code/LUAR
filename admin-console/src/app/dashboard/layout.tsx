import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { signOutAction } from "@/app/actions/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/dashboard" className="admin-sidebar-brand"><span className="admin-mark">☾</span><span><b>LUAR</b><small>PAINEL ADMIN</small></span></Link><AdminNav /><form action={signOutAction}><Button type="submit" variant="ghost" className="w-full justify-start"><SignOut />Sair com segurança</Button></form></aside>
    <main className="admin-main"><header className="admin-topbar"><div><span>AMBIENTE PROTEGIDO</span><b>Operações LUAR</b></div><div className="admin-user"><span>{(user.email || "A").slice(0, 2).toUpperCase()}</span><div><b>Administrador</b><small>{user.email}</small></div></div></header>{children}</main></div>;
}
