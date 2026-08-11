"use client";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <section className="admin-page admin-error"><WarningCircle weight="duotone" /><h1>Não foi possível carregar esta área.</h1><p>Nenhum dado foi alterado. Tente carregar novamente.</p><Button onClick={reset}>Tentar novamente</Button></section>; }
