import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ExternalLink, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_STATUS_LABELS, formatEventDate, formatEventMoney } from "@/lib/events/utils";
import { RegistrationTypeForm } from "@/components/events/registration-type-form";
import { BenefitRuleForm } from "@/components/events/benefit-rule-form";
import { cancelEvent, closeRegistrations, createBenefitRule, createRegistrationType, openRegistrations, publishEvent, startEvent, toggleBenefitRule, toggleRegistrationType } from "@/app/admin/eventos/actions";

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{created?:string;updated?:string}> }) {
  const session = await requirePermission(PERMISSIONS.EVENTS_VIEW);
  const { id } = await params;
  const qs = await searchParams;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      registrationTypes: { orderBy: [{ sortOrder:"asc" },{ name:"asc" }] },
      exemptionRules: { orderBy: [{ sortOrder:"asc" },{ name:"asc" }] },
      _count: { select: { registrations:true, orders:true } },
      cashTransactions: { select:{type:true,amount:true,metadata:true} },
    },
  });
  if (!event) notFound();

  const income = event.cashTransactions.filter(x=>x.type==="INCOME").reduce((a,x)=>a+Number(x.amount),0);
  const expense = event.cashTransactions.filter(x=>x.type==="EXPENSE").reduce((a,x)=>a+Number(x.amount),0);
  const addType = createRegistrationType.bind(null,event.id);
  const addBenefit = createBenefitRule.bind(null,event.id);

  return <div className="space-y-6">
    {(qs.created||qs.updated)&&<div className="rounded-md border p-3 text-sm">{qs.created?"Evento criado com sucesso.":"Evento atualizado com sucesso."}</div>}
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="mb-2 flex items-center gap-2"><Badge>{EVENT_STATUS_LABELS[event.status]}</Badge>{event.isPublic&&<Badge>Público</Badge>}</div><h1 className="text-2xl font-bold tracking-tight">{event.name}</h1><p className="text-muted-foreground">{formatEventDate(event.startsAt)}</p></div>
      <div className="flex flex-wrap gap-2">{event.isPublic&&event.status!=="DRAFT"&&<Link href={`/eventos/${event.slug}`} target="_blank"><Button variant="outline"><ExternalLink className="mr-2 h-4 w-4"/>Página pública</Button></Link>}{hasPermission(session.user.roles,PERMISSIONS.EVENTS_OPERATION)&&<Link href={`/admin/eventos/${event.id}/operacao`}><Button><Activity className="mr-2 h-4 w-4"/>Operação</Button></Link>}{hasPermission(session.user.roles,PERMISSIONS.EVENTS_UPDATE)&&<Link href={`/admin/eventos/${event.id}/editar`}><Button variant="outline"><Pencil className="mr-2 h-4 w-4"/>Editar</Button></Link>}</div>
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      <Metric title="Inscrições" value={`${event._count.registrations}${event.capacity?` / ${event.capacity}`:""}`}/>
      <Metric title="Comandas" value={String(event._count.orders)}/>
      <Metric title="Receitas vinculadas" value={formatEventMoney(income)}/>
      <Metric title="Resultado financeiro" value={formatEventMoney(income-expense)}/>
    </div>

    <Card><CardHeader><CardTitle>Controle do evento</CardTitle><CardDescription>Alterações de status são auditadas.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">
      {hasPermission(session.user.roles,PERMISSIONS.EVENTS_PUBLISH)&&<>
        {event.status==="DRAFT"&&<form action={publishEvent.bind(null,event.id)}><Button type="submit">Publicar</Button></form>}
        {(event.status==="PUBLISHED"||event.status==="REGISTRATIONS_CLOSED")&&<form action={openRegistrations.bind(null,event.id)}><Button type="submit">Abrir inscrições</Button></form>}
        {event.status==="REGISTRATIONS_OPEN"&&<form action={closeRegistrations.bind(null,event.id)}><Button type="submit" variant="outline">Encerrar inscrições</Button></form>}
        {(event.status==="PUBLISHED"||event.status==="REGISTRATIONS_OPEN"||event.status==="REGISTRATIONS_CLOSED")&&<form action={startEvent.bind(null,event.id)}><Button type="submit" variant="secondary">Iniciar evento</Button></form>}
      </>}
      {hasPermission(session.user.roles,PERMISSIONS.EVENTS_CANCEL)&&event.status!=="FINISHED"&&event.status!=="CANCELED"&&<form action={cancelEvent.bind(null,event.id)}><Button type="submit" variant="outline">Cancelar evento</Button></form>}
    </CardContent></Card>

    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Informações</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <Info label="Local" value={[event.location,event.address,event.city,event.state].filter(Boolean).join(" • ")||"Não informado"}/>
        <Info label="Período" value={`${formatEventDate(event.startsAt)}${event.endsAt?` até ${formatEventDate(event.endsAt)}`:""}`}/>
        <Info label="Inscrições" value={`${event.registrationOpensAt?formatEventDate(event.registrationOpensAt):"sem data de abertura"} — ${event.registrationClosesAt?formatEventDate(event.registrationClosesAt):"sem data de encerramento"}`}/>
        <Info label="Preço padrão" value={formatEventMoney(event.defaultPrice)}/>
        <Info label="Participantes" value={[event.allowMembers&&"membros",event.allowNonMembers&&"não membros",event.allowCompanions&&"acompanhantes",event.allowGroupRegistration&&"grupos"].filter(Boolean).join(", ")||"Nenhum perfil habilitado"}/>
        {event.description&&<div><div className="font-medium">Descrição</div><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{event.description}</p></div>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Tipos de inscrição</CardTitle><CardDescription>Preços específicos substituem o valor padrão para o participante.</CardDescription></CardHeader><CardContent className="space-y-5">
        {hasPermission(session.user.roles,PERMISSIONS.EVENTS_TYPES)&&<RegistrationTypeForm action={addType}/>}
        <div className="divide-y rounded-md border">{event.registrationTypes.map(t=><div key={t.id} className="flex items-center justify-between gap-3 p-3"><div><div className="font-medium">{t.name} {!t.active&&<span className="text-xs text-muted-foreground">(inativo)</span>}</div><div className="text-xs text-muted-foreground">{formatEventMoney(t.price)}{t.minAge!=null||t.maxAge!=null?` • idade ${t.minAge??0}–${t.maxAge??"∞"}`:""}</div></div>{hasPermission(session.user.roles,PERMISSIONS.EVENTS_TYPES)&&<form action={toggleRegistrationType.bind(null,t.id,event.id)}><Button type="submit" size="sm" variant="outline">{t.active?"Inativar":"Ativar"}</Button></form>}</div>)}{!event.registrationTypes.length&&<div className="p-5 text-sm text-muted-foreground">Nenhum tipo cadastrado; será usado o preço padrão do evento.</div>}</div>
      </CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Benefícios e isenções</CardTitle><CardDescription>Regras que podem ser solicitadas no formulário público e dependem de aprovação.</CardDescription></CardHeader><CardContent className="space-y-5">
      {hasPermission(session.user.roles,PERMISSIONS.EVENTS_TYPES)&&<BenefitRuleForm action={addBenefit}/>}
      <div className="divide-y rounded-md border">{event.exemptionRules.map(r=><div key={r.id} className="flex items-center justify-between gap-3 p-3"><div><div className="font-medium">{r.name} {!r.active&&<span className="text-xs text-muted-foreground">(inativa)</span>}</div><div className="text-xs text-muted-foreground">{r.benefitType}{r.benefitValue!=null?` • ${r.benefitValue.toString()}`:""}</div></div>{hasPermission(session.user.roles,PERMISSIONS.EVENTS_TYPES)&&<form action={toggleBenefitRule.bind(null,r.id,event.id)}><Button size="sm" variant="outline">{r.active?"Inativar":"Ativar"}</Button></form>}</div>)}{!event.exemptionRules.length&&<div className="p-5 text-sm text-muted-foreground">Nenhuma regra de benefício cadastrada.</div>}</div>
    </CardContent></Card>
  </div>;
}
function Metric({title,value}:{title:string;value:string}) { return <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card> }
function Info({label,value}:{label:string;value:string}) { return <div><div className="font-medium">{label}</div><div className="text-muted-foreground">{value}</div></div> }
