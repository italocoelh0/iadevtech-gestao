"use client";

import { useActionState } from "react";
import type { EventActionState } from "@/app/admin/eventos/actions";
import { Button } from "@/components/ui/button";

export function RegistrationTypeForm({ action }: {
  action: (state: EventActionState, formData: FormData) => Promise<EventActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const err=(k:string)=>state.fieldErrors?.[k]?.[0];
  return <form action={formAction} className="grid gap-3 md:grid-cols-5">
    {state.error&&<div className="md:col-span-5 rounded-md border p-3 text-sm">{state.error}</div>}
    <label className="md:col-span-2 text-sm font-medium">Nome<input name="name" className="input mt-1" placeholder="Ex.: Membro" required/>{err("name")&&<span className="text-xs text-red-600">{err("name")}</span>}</label>
    <label className="text-sm font-medium">Preço<input name="price" type="number" min="0" step="0.01" className="input mt-1" defaultValue="0.00"/></label>
    <label className="text-sm font-medium">Idade mín.<input name="minAge" type="number" min="0" className="input mt-1"/></label>
    <label className="text-sm font-medium">Idade máx.<input name="maxAge" type="number" min="0" className="input mt-1"/></label>
    <label className="md:col-span-4 text-sm font-medium">Descrição<input name="description" className="input mt-1"/></label>
    <div className="flex items-end"><Button type="submit" disabled={pending}>{pending?"Adicionando...":"Adicionar tipo"}</Button></div>
  </form>;
}
