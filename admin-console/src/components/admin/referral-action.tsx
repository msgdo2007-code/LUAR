"use client";

import { useActionState } from "react";
import { SpinnerGap } from "@phosphor-icons/react";
import { reviewReferralAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ReferralRow } from "@/types/admin";

export function ReferralAction({ referral }: { referral: ReferralRow }) {
  const [state, action, pending] = useActionState(reviewReferralAction, {});

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Revisar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revisar indicação #{referral.id}</DialogTitle>
          <DialogDescription>
            A decisão será registrada no histórico de auditoria do administrador.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={referral.id} />
          <div className="space-y-2">
            <Label>Ação</Label>
            <Select name="action" defaultValue="approve">
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approve">Aprovar</SelectItem>
                <SelectItem value="reject">Rejeitar</SelectItem>
                <SelectItem value="flag">Marcar para revisão</SelectItem>
                <SelectItem value="correct">Corrigir código</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`reason-${referral.id}`}>Motivo</Label>
            <Textarea id={`reason-${referral.id}`} name="reason" minLength={5} maxLength={500} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`code-${referral.id}`}>Novo código (somente para correção)</Label>
            <Input id={`code-${referral.id}`} name="newCode" minLength={8} maxLength={16} pattern="[A-Za-z0-9]{8,16}" defaultValue={referral.code} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`flags-${referral.id}`}>Sinais de fraude, separados por vírgula</Label>
            <Input id={`flags-${referral.id}`} name="flags" maxLength={500} defaultValue={referral.fraud_flags.join(", ")} />
          </div>
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <SpinnerGap className="animate-spin" />}
            {pending ? "Salvando…" : "Registrar revisão"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
