"use client";

import { useActionState, useState } from "react";
import { Crown, SpinnerGap } from "@phosphor-icons/react";
import { setLifetimeAction } from "@/app/actions/admin";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function LifetimeAction({ email, active }: { email: string; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(setLifetimeAction, {});
  return <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger render={<Button size="sm" variant={active ? "outline" : "default"} />}><Crown />{active ? "Revogar" : "Conceder"}</AlertDialogTrigger>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{active ? "Revogar concessão administrativa?" : "Conceder LUAR Vitalício?"}</AlertDialogTitle><AlertDialogDescription>A alteração será aplicada a <strong>{email}</strong> e registrada permanentemente no log de auditoria. Compras reais nunca são apagadas por esta ação.</AlertDialogDescription></AlertDialogHeader>
      <form action={action} className="space-y-4"><input type="hidden" name="email" value={email} /><input type="hidden" name="action" value={active ? "revoke" : "grant"} /><input type="hidden" name="confirmation" value="CONFIRMAR" />
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
        <AlertDialogFooter><AlertDialogCancel type="button">Cancelar</AlertDialogCancel><AlertDialogAction type="submit" disabled={pending}>{pending && <SpinnerGap className="animate-spin" />}{pending ? "Salvando…" : "Confirmar alteração"}</AlertDialogAction></AlertDialogFooter>
      </form>
    </AlertDialogContent>
  </AlertDialog>;
}
