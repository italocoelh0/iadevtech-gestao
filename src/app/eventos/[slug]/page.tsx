import { RegistrationStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_STATUS_LABELS, formatEventDate, formatEventMoney } from "@/lib/events/utils";

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const {slug}=await params;
  const event=await prisma.event.findFirst({
    where:{slug,isPublic:true,status:{in:["PUBLISHED","REGISTRATIONS_OPEN","REGISTRATIONS_CLOSED","IN_PROGRESS"]}},
    include:{registrationTypes:{where:{active:true},orderBy:[{sortOrder:"asc"},{name:"asc"}]}},
  });
  if(!event) notFound();
  const now=new Date();
  const withinWindow=(!event.registrationOpensAt||now>=event.registrationOpensAt)&&(!event.registrationClosesAt||now<=event.registrationClosesAt);
  const occupied=await prisma.eventParticipant.count({where:{registration:{eventId:event.id,status:{notIn:[RegistrationStatus.CANCELED,RegistrationStatus.WAITLIST]}}}});
  const capacityAvailable=!event.capacity||occupied<event.capacity;
  const registrationOpen=event.status==="REGISTRATIONS_OPEN"&&withinWindow&&capacityAvailable;

  return <main className="min-h-screen bg-muted/30">
    {event.coverImageUrl&&<div className="mx-auto max-w-6xl px-4 pt-6 md:px-8"><div className="aspect-[16/6] overflow-hidden rounded-2xl bg-muted"><img src={event.coverImageUrl} alt="" className="h-full w-full object-cover"/></div></div>}
    <div className="mx-auto grid max-w-6xl gap-6 p-4 py-8 md:p-8 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6"><div><Badge>{EVENT_STATUS_LABELS[event.status]}</Badge><h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{event.name}</h1></div>
      <div className="grid gap-3 sm:grid-cols-3"><Fact icon="calendar" title="Data" value={formatEventDate(event.startsAt)}/><Fact icon="map" title="Local" value={[event.location,event.city].filter(Boolean).join(" • ")||"A confirmar"}/><Fact icon="users" title="Capacidade" value={event.capacity?`${occupied} de ${event.capacity} vagas`:"Sem limite informado"}/></div>
      {event.description&&<Card><CardHeader><CardTitle>Sobre o evento</CardTitle></CardHeader><CardContent><div className="whitespace-pre-wrap leading-7 text-muted-foreground">{event.description}</div></CardContent></Card>}
      {event.address&&<Card><CardHeader><CardTitle>Endereço</CardTitle></CardHeader><CardContent className="text-muted-foreground">{[event.address,event.city,event.state].filter(Boolean).join(" • ")}</CardContent></Card>}
      </section>
      <aside><Card className="sticky top-6"><CardHeader><CardTitle>Inscrição</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-2">{event.registrationTypes.length?event.registrationTypes.map(t=><div key={t.id} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{t.name}</span><strong>{formatEventMoney(t.price)}</strong></div>):<div className="flex justify-between text-sm"><span>Valor</span><strong>{formatEventMoney(event.defaultPrice)}</strong></div>}</div>
        {registrationOpen?<a href={`/eventos/${event.slug}/inscricao`} className="block rounded-md bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground">Fazer inscrição</a>:<div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{!capacityAvailable?"Capacidade atingida.":"Inscrições indisponíveis no momento."}</div>}
      </CardContent></Card><Card className="mt-4"><CardHeader><CardTitle>Comanda do evento</CardTitle></CardHeader><CardContent><a href={`/comanda/abrir?evento=${event.slug}`} className="block rounded-md border px-4 py-3 text-center text-sm font-medium hover:bg-accent">Abrir minha comanda</a><p className="mt-2 text-xs text-muted-foreground">Informe nome e celular. Você poderá lançar seus próprios consumos e fechar a comanda; correções de itens ficam com a equipe.</p></CardContent></Card></aside>
    </div>
  </main>;
}
function Fact({icon,title,value}:{icon:"calendar"|"map"|"users";title:string;value:string}) { const Icon=icon==="calendar"?CalendarDays:icon==="map"?MapPin:Users; return <div className="rounded-xl border bg-card p-4"><Icon className="mb-2 h-5 w-5"/><div className="text-xs text-muted-foreground">{title}</div><div className="mt-1 text-sm font-medium">{value}</div></div> }
