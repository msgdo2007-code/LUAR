"use client";

import { useActionState } from "react";
import { LockKey, SpinnerGap } from "@phosphor-icons/react";
import { signInAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, {});
  return <form action={action} className="space-y-5" aria-describedby={state.error ? "login-error" : undefined}>
    <div className="hidden" aria-hidden="true"><Label htmlFor="website">Site</Label><Input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
    <div className="space-y-2"><Label htmlFor="email">E-mail administrativo</Label><Input id="email" name="email" type="email" autoComplete="username" maxLength={254} required /></div>
    <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required /></div>
    {state.error && <p id="login-error" role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
    <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? <SpinnerGap className="animate-spin" /> : <LockKey />} {pending ? "Verificando…" : "Entrar com segurança"}</Button>
  </form>;
}
