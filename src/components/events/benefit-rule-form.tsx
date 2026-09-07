"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { EventActionState } from "@/app/admin/eventos/actions";

const initial: EventActionState = {};
export function BenefitRuleForm({ action }: { action: (state: EventActionState, formData: FormData) => Promise<EventActionState> }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const input="h-10 w-full rounded-md border bg-background px-3 text-sm";
  return <form action={formAction} className="space-y-3 rounded-md border p-4">
    {state.error&&<div className="text-sm text-red-600">{state.error}</div>}
    <div className="grid gap-3 sm:grid-cols-2"><input name="name" placeholder="Nome da regra" required className={input}/><select name="benefitType" className={input}><option value="EXEMPTION">Isenção total</option><option value="PERCENTAGE_DISCOUNT">Desconto percentual</option><option value="FIXED_DISCOUNT">Desconto fixo</option><option value="SPECIAL_PRICE">Preço especial</option></select></div>
    <div className="grid gap-3 sm:grid-cols-2"><input name="benefitValue" type="number" min="0" step="0.01" placeholder="Valor / percentual" className={input}/><input name="description" placeholder="Descrição" className={input}/></div>
    <Button size="sm" disabled={pending}>{pending?"Salvando...":"Adicionar regra"}</Button>
  </form>;
}
