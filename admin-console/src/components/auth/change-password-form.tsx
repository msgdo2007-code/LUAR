"use client";

import { useActionState } from "react";
import { Key, SpinnerGap } from "@phosphor-icons/react";
import { changePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  return <form action={action} className="space-y-5">
    <div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /><small className="text-muted-foreground">Mínimo de 10 caracteres, contendo letras e números.</small></div>
    <div className="space-y-2"><Label htmlFor="password-confirmation">Repetir nova senha</Label><Input id="password-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></div>
    {state.error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
    {state.success && <p role="status" className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">{state.success}</p>}
    <Button type="submit" className="w-full" disabled={pending}>{pending ? <SpinnerGap className="animate-spin" /> : <Key />}{pending ? "Alterando…" : "Alterar minha senha"}</Button>
  </form>;
}
