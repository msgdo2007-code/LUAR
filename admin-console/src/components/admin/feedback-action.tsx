"use client";

import { useActionState } from "react";
import { SpinnerGap } from "@phosphor-icons/react";
import { updateFeedbackAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackRow } from "@/types/admin";

export function FeedbackAction({ feedback }: { feedback: FeedbackRow }) {
  const [state, action, pending] = useActionState(updateFeedbackAction, {});
  return <Dialog><DialogTrigger render={<Button size="sm" variant="outline" />}>Analisar</DialogTrigger><DialogContent>
    <DialogHeader><DialogTitle>Atualizar feedback #{feedback.id}</DialogTitle><DialogDescription>A resposta e o novo status serão associados ao administrador autenticado.</DialogDescription></DialogHeader>
    <form action={action} className="space-y-4"><input type="hidden" name="id" value={feedback.id} /><div className="space-y-2"><Label>Status</Label><Select name="status" defaultValue={feedback.status}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="reviewing">Em análise</SelectItem><SelectItem value="approved">Aprovado</SelectItem><SelectItem value="rejected">Recusado</SelectItem><SelectItem value="implemented">Implementado</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor={`response-${feedback.id}`}>Resposta</Label><Textarea id={`response-${feedback.id}`} name="response" maxLength={1200} defaultValue={feedback.admin_response || ""} /></div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending && <SpinnerGap className="animate-spin" />}{pending ? "Salvando…" : "Salvar análise"}</Button></form>
  </DialogContent></Dialog>;
}
