import { ExportButtons } from "@/components/admin/export-buttons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { getEventOperation } from "@/lib/events/operation";
import { formatEventMoney } from "@/lib/events/utils";
import { checkInParticipant, reverseCheckIn } from "../../checkin-actions";
import { finishEventOperationally } from "../../operation-actions";

export default async function EventOperationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const session = await requirePermission(PERMISSIONS.EVENTS_OPERATION);
  const { id } = await params; const { q = "" } = await searchParams;
  const data = await getEventOperation(id); if (!data) return notFound();
  const query=q.trim().toLowerCase();
  const participants=data.participants.filter(p=>!query || p.name.toLowerCase().includes(query) || (p.phone??"").includes(query));
  const canCheckin=hasPermission(session.user.roles,PERMISSIONS.EVENTS_CHECKIN);
  const canFinish=hasPermission(session.user.roles,PERMISSIONS.EVENTS_FINISH);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><Link href={`/admin/eventos/${id}`} className="text-sm text-muted-foreground underline">← Evento</Link><h1 className="mt-2 text-2xl font-bold">Operação — {data.event.name}</h1><p className="text-muted-foreground">Presença, pendências e fechamento operacional.</p></div><div className="flex flex-col items-end gap-2"><Badge>{data.event.status}</Badge><ExportButtons baseUrl={`/api/export/presenca?eventId=${id}`}/></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric t="Inscritos" v={String(data.participants.length)}/><Metric t="Presentes" v={String(data.present)}/><Metric t="Ausentes" v={String(data.absent)}/><Metric t="Comandas pendentes" v={String(data.openOrders.length)}/><Metric t="Resultado" v={formatEventMoney(data.finance.balance)}/></div>
    <Card><CardHeader><CardTitle>Fechamento do evento</CardTitle><CardDescription>O fechamento é bloqueado enquanto houver pendências financeiras operacionais.</CardDescription></CardHeader><CardContent className="space-y-3">{data.blockers.length?<div className="rounded-md border p-3 text-sm"><strong>Pendências:</strong><ul className="mt-2 list-disc pl-5">{data.blockers.map(b=><li key={b}>{b}</li>)}</ul></div>:<div className="rounded-md border p-3 text-sm">Nenhuma pendência bloqueante encontrada.</div>}{canFinish&&data.canFinish&&<form action={finishEventOperationally.bind(null,id)}><SubmitButton pendingText="Finalizando...">Finalizar evento</SubmitButton></form>}</CardContent></Card>
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Card><CardHeader><CardTitle>Lista de presença</CardTitle><CardDescription>Pesquise por nome ou telefone e registre a presença manualmente.</CardDescription></CardHeader><CardContent><form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Nome ou telefone" className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"/><Button variant="outline">Buscar</Button></form><div className="divide-y rounded-md border">{participants.map(p=>{const checked=p.checkins.length>0;return <div key={p.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.phone||"Sem telefone"} • {p.registrationType?.name??"Padrão"}</div></div><div className="flex items-center gap-2"><Badge>{checked?"Presente":"Não chegou"}</Badge>{canCheckin&&(checked?<form action={reverseCheckIn.bind(null,p.id)}><SubmitButton size="sm" variant="outline" pendingText="Revertendo...">Reverter</SubmitButton></form>:<form action={checkInParticipant.bind(null,p.id)}><SubmitButton size="sm" pendingText="Registrando...">Check-in</SubmitButton></form>)}</div></div>})}{!participants.length&&<div className="p-5 text-sm text-muted-foreground">Nenhum participante encontrado.</div>}</div></CardContent></Card>
      <div className="space-y-6"><Card><CardHeader><CardTitle>Pendências financeiras</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Inscrições pendentes</span><strong>{data.unpaidRegistrations.length}</strong></div><div className="flex justify-between"><span>Comandas pendentes</span><strong>{data.openOrders.length}</strong></div><div className="flex justify-between"><span>Receitas</span><strong>{formatEventMoney(data.finance.income)}</strong></div><div className="flex justify-between"><span>Despesas</span><strong>{formatEventMoney(data.finance.expense)}</strong></div></CardContent></Card><Card><CardHeader><CardTitle>Consumo do evento</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{data.consumption.slice(0,10).map(i=><div key={i.name} className="flex justify-between"><span>{i.name}</span><strong>{i.quantity.toLocaleString("pt-BR",{maximumFractionDigits:3})}</strong></div>)}{!data.consumption.length&&<p className="text-muted-foreground">Nenhum consumo registrado.</p>}</CardContent></Card></div>
    </div>
  </div>;
}
function Metric({t,v}:{t:string;v:string}){return <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{v}</div></CardContent></Card>}
