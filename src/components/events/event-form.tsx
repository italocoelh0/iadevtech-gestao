"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EventActionState } from "@/app/admin/eventos/actions";

type InitialValues = {
  name?: string;
  slug?: string;
  description?: string | null;
  coverImageUrl?: string | null;
  startsAt?: string;
  endsAt?: string;
  location?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  capacity?: number | null;
  defaultPrice?: string;
  isPublic?: boolean;
  allowMembers?: boolean;
  allowNonMembers?: boolean;
  allowCompanions?: boolean;
  allowGroupRegistration?: boolean;
  notes?: string | null;
};

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function EventForm({ action, initialValues = {}, submitLabel }: {
  action: (state: EventActionState, formData: FormData) => Promise<EventActionState>;
  initialValues?: InitialValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [name, setName] = useState(initialValues.name ?? "");
  const [slug, setSlug] = useState(initialValues.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues.slug));
  const previewSlug = useMemo(() => slugTouched ? slug : slugify(name), [name, slug, slugTouched]);
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  const label = "text-sm font-medium";

  return <form action={formAction} className="space-y-6">
    {state.error && <div className="rounded-md border p-3 text-sm">{state.error}</div>}
    <div className="grid gap-5 md:grid-cols-2">
      <label className="md:col-span-2"><span className={label}>Nome *</span><input name="name" value={name} onChange={e=>setName(e.target.value)} className="input mt-1" required />{error("name")&&<p className="mt-1 text-xs text-red-600">{error("name")}</p>}</label>
      <label className="md:col-span-2"><span className={label}>Slug público *</span><input name="slug" value={previewSlug} onChange={e=>{setSlugTouched(true);setSlug(e.target.value)}} className="input mt-1" required/><p className="mt-1 text-xs text-muted-foreground">URL: /eventos/{previewSlug || "meu-evento"}</p>{error("slug")&&<p className="mt-1 text-xs text-red-600">{error("slug")}</p>}</label>
      <label className="md:col-span-2"><span className={label}>Descrição</span><textarea name="description" defaultValue={initialValues.description ?? ""} className="mt-1 min-h-32 w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"/></label>
      <label className="md:col-span-2"><span className={label}>URL da imagem de capa</span><input name="coverImageUrl" type="url" defaultValue={initialValues.coverImageUrl ?? ""} className="input mt-1" placeholder="https://..."/>{error("coverImageUrl")&&<p className="mt-1 text-xs text-red-600">{error("coverImageUrl")}</p>}</label>
      <label><span className={label}>Início *</span><input name="startsAt" type="datetime-local" defaultValue={initialValues.startsAt ?? ""} className="input mt-1" required/>{error("startsAt")&&<p className="mt-1 text-xs text-red-600">{error("startsAt")}</p>}</label>
      <label><span className={label}>Fim</span><input name="endsAt" type="datetime-local" defaultValue={initialValues.endsAt ?? ""} className="input mt-1"/>{error("endsAt")&&<p className="mt-1 text-xs text-red-600">{error("endsAt")}</p>}</label>
      <label><span className={label}>Local</span><input name="location" defaultValue={initialValues.location ?? ""} className="input mt-1"/></label>
      <label><span className={label}>Endereço</span><input name="address" defaultValue={initialValues.address ?? ""} className="input mt-1"/></label>
      <label><span className={label}>Cidade</span><input name="city" defaultValue={initialValues.city ?? ""} className="input mt-1"/></label>
      <label><span className={label}>Estado</span><input name="state" maxLength={2} defaultValue={initialValues.state ?? ""} className="input mt-1" placeholder="MS"/></label>
      <label><span className={label}>Abertura das inscrições</span><input name="registrationOpensAt" type="datetime-local" defaultValue={initialValues.registrationOpensAt ?? ""} className="input mt-1"/></label>
      <label><span className={label}>Encerramento das inscrições</span><input name="registrationClosesAt" type="datetime-local" defaultValue={initialValues.registrationClosesAt ?? ""} className="input mt-1"/></label>
      <label><span className={label}>Capacidade</span><input name="capacity" type="number" min="1" defaultValue={initialValues.capacity ?? ""} className="input mt-1"/></label>
      <label><span className={label}>Preço padrão (R$)</span><input name="defaultPrice" type="number" min="0" step="0.01" defaultValue={initialValues.defaultPrice ?? "0.00"} className="input mt-1"/></label>
    </div>

    <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
      <Check name="isPublic" label="Evento visível publicamente" defaultChecked={initialValues.isPublic ?? true}/>
      <Check name="allowMembers" label="Permitir membros" defaultChecked={initialValues.allowMembers ?? true}/>
      <Check name="allowNonMembers" label="Permitir não membros" defaultChecked={initialValues.allowNonMembers ?? true}/>
      <Check name="allowCompanions" label="Permitir acompanhantes" defaultChecked={initialValues.allowCompanions ?? true}/>
      <Check name="allowGroupRegistration" label="Permitir inscrição em grupo" defaultChecked={initialValues.allowGroupRegistration ?? true}/>
    </div>

    <label className="block"><span className={label}>Observações internas</span><textarea name="notes" defaultValue={initialValues.notes ?? ""} className="mt-1 min-h-24 w-full rounded-md border bg-background p-3 text-sm"/></label>
    <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Salvando..." : submitLabel}</Button></div>
  </form>;
}

function Check({name,label,defaultChecked}:{name:string;label:string;defaultChecked:boolean}) {
  return <label className="flex items-center gap-3 text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4"/><span>{label}</span></label>;
}
