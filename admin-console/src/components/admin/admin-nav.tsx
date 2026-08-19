"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar, Gauge, ShieldCheck, Trophy, UsersThree, ChatCircleText, UserCircle, ShareNetwork, PaintBrush } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const links = [
  ["/dashboard", "Visão geral", Gauge],
  ["/dashboard/users", "Usuários", UsersThree],
  ["/dashboard/rankings", "Rankings", Trophy],
  ["/dashboard/feedback", "Feedback", ChatCircleText],
  ["/dashboard/referrals", "Indicações", ShareNetwork],
  ["/dashboard/landing", "Landing Page", PaintBrush],
  ["/dashboard/audit", "Auditoria", ShieldCheck],
  ["/dashboard/account", "Conta e segurança", UserCircle],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return <nav className="admin-nav" aria-label="Navegação administrativa">{links.map(([href, label, Icon]) => {
    const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
    return <Link key={href} href={href} className={cn("admin-nav-link", active && "active")}><Icon weight={active ? "fill" : "regular"} /><span>{label}</span></Link>;
  })}<div className="admin-nav-spacer" /><div className="admin-security-state"><ChartBar weight="duotone" /><span><b>RLS ativo</b><small>Operações validadas no servidor</small></span></div></nav>;
}
