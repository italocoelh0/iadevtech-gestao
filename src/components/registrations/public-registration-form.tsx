"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PublicRegistrationState } from "@/app/eventos/[slug]/inscricao/actions";

const initialState: PublicRegistrationState = {};

type TypeOption = { id: string; name: string; price: string };
type BenefitOption = { id: string; name: string; description: string | null };

export function PublicRegistrationForm({ action, types, benefits, allowGroup }: { action: (state: PublicRegistrationState, formData: FormData) => Promise<PublicRegistrationState>; types: TypeOption[]; benefits: BenefitOption[]; allowGroup: boolean }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [count, setCount] = useState(1);
  const input = "h-10 w-full rounded-md border bg-background px-3 text-sm";

  return <form action={formAction} className="space-y-6">
    <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {state.error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Responsável pela inscrição</h2>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Nome *</span><input name="name" required className={input}/></label><label className="space-y-1 text-sm"><span>Celular *</span><input name="phone" required className={input}/></label></div>
      <label className="block space-y-1 text-sm"><span>E-mail</span><input name="email" type="email" className={input}/></label>
    </section>

    <section className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Participantes</h2>{allowGroup && <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={()=>setCount(Math.max(1,count-1))}>−</Button><span className="min-w-8 py-1 text-center text-sm">{count}</span><Button type="button" variant="outline" size="sm" onClick={()=>setCount(Math.min(10,count+1))}>+</Button></div>}</div>
      <input type="hidden" name="participantCount" value={count}/>
      {Array.from({length:count},(_,i)=><div key={i} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3"><label className="space-y-1 text-sm"><span>Nome *</span><input name={`participant.${i}.name`} required className={input}/></label><label className="space-y-1 text-sm"><span>Tipo de inscrição</span><select name={`participant.${i}.registrationTypeId`} className={input}><option value="">Valor padrão</option>{types.map(t=><option key={t.id} value={t.id}>{t.name} — R$ {Number(t.price).toFixed(2).replace('.',',')}</option>)}</select></label><label className="space-y-1 text-sm"><span>Nascimento</span><input name={`participant.${i}.birthDate`} type="date" className={input}/></label></div>)}
    </section>

    {benefits.length>0 && <section className="space-y-3"><h2 className="text-lg font-semibold">Benefício / isenção</h2><label className="block space-y-1 text-sm"><span>Solicitar benefício</span><select name="benefitRuleId" className={input}><option value="">Não solicitar</option>{benefits.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="block space-y-1 text-sm"><span>Justificativa</span><textarea name="benefitReason" rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm"/></label><p className="text-xs text-muted-foreground">A solicitação depende de aprovação administrativa e não representa confirmação automática do benefício.</p></section>}
    <label className="block space-y-1 text-sm"><span>Observações</span><textarea name="notes" rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm"/></label>
    <Button disabled={pending} type="submit" className="w-full">{pending?"Enviando...":"Concluir inscrição"}</Button>
  </form>;
}
