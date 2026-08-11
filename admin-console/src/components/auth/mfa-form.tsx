"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { Key, SpinnerGap } from "@phosphor-icons/react";
import { prepareMfaAction, verifyMfaAction, type AuthActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MfaForm() {
  const [setup, setSetup] = useState<AuthActionState>({});
  const [state, action, pending] = useActionState(verifyMfaAction, {});
  useEffect(() => { prepareMfaAction().then(setSetup).catch(() => setSetup({ error: "Não foi possível preparar o autenticador." })); }, []);
  if (setup.error) return <p role="alert" className="text-sm text-destructive">{setup.error}</p>;
  if (!setup.enrollment) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><SpinnerGap className="animate-spin" /> Preparando autenticação…</div>;
  return <form action={action} className="space-y-5">
    {setup.enrollment.qrCode && <div className="space-y-3 rounded-xl border bg-white p-4 text-center text-zinc-900"><p className="text-sm font-semibold">Escaneie no seu aplicativo autenticador</p><Image className="mx-auto size-44" src={setup.enrollment.qrCode} width={176} height={176} unoptimized alt="QR Code para ativar o autenticador do LUAR Admin" /><p className="break-all font-mono text-[11px]">{setup.enrollment.secret}</p></div>}
    <input type="hidden" name="factorId" value={setup.enrollment.factorId} />
    <div className="space-y-2"><Label htmlFor="code">Código de seis números</Label><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></div>
    {state.error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
    <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? <SpinnerGap className="animate-spin" /> : <Key />} {pending ? "Validando…" : "Confirmar código"}</Button>
  </form>;
}
