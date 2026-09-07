"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { openPublicOrder, type PublicOrderState } from "@/app/comanda/abrir/actions";

const initialState: PublicOrderState = {};
export function PublicOpenOrderForm({ eventId }: { eventId?: string }) {
  const [state, action, pending] = useActionState(openPublicOrder, initialState);
  return <form action={action} className="space-y-4">
    <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {eventId ? <input type="hidden" name="eventId" value={eventId}/> : null}
    {state.error&&<div className="rounded-md border p-3 text-sm">{state.error}</div>}
    <label className="block text-sm font-medium">Nome<input name="customerName" className="input mt-1" placeholder="Seu nome" required/></label>{state.fieldErrors?.customerName?.map(e=><p key={e} className="text-xs text-red-600">{e}</p>)}
    <label className="block text-sm font-medium">Celular<input name="customerPhone" className="input mt-1" placeholder="(67) 99999-9999" inputMode="tel" required/></label>{state.fieldErrors?.customerPhone?.map(e=><p key={e} className="text-xs text-red-600">{e}</p>)}
    <Button className="w-full" disabled={pending}>{pending?"Verificando...":"Abrir ou continuar minha comanda"}</Button>
  </form>;
}
