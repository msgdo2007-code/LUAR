import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
export default function NotFound() { return <main className="admin-login-shell"><div className="admin-error"><span className="admin-mark">☾</span><h1>Página não encontrada</h1><p>Esta rota administrativa não existe.</p><Link className={buttonVariants()} href="/dashboard">Voltar ao painel</Link></div></main>; }
