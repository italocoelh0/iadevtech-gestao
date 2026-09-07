import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_STATUS_LABELS, formatEventDate, formatEventMoney } from "@/lib/events/utils";

export default async function PublicEventsPage() {
  const events = await prisma.event.findMany({
    where: { isPublic:true, status:{ in:["PUBLISHED","REGISTRATIONS_OPEN","REGISTRATIONS_CLOSED","IN_PROGRESS"] } },
    include: { registrationTypes:{ where:{active:true}, orderBy:{sortOrder:"asc"} } },
    orderBy:{startsAt:"asc"},
  });
  return <main className="mx-auto min-h-screen max-w-6xl p-4 py-10 md:p-8">
    <div className="mb-8"><h1 className="text-3xl font-bold">Eventos</h1><p className="mt-2 text-muted-foreground">Confira os próximos eventos e informações para inscrição.</p></div>
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{events.map(e=><Link key={e.id} href={`/eventos/${e.slug}`} className="block"><Card className="h-full transition-shadow hover:shadow-md">{e.coverImageUrl&&<div className="aspect-[16/8] overflow-hidden rounded-t-xl bg-muted"><img src={e.coverImageUrl} alt="" className="h-full w-full object-cover"/></div>}<CardHeader><div className="mb-2"><Badge>{EVENT_STATUS_LABELS[e.status]}</Badge></div><CardTitle>{e.name}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>{formatEventDate(e.startsAt)}</p><p className="text-muted-foreground">{[e.location,e.city].filter(Boolean).join(" • ")||"Local a confirmar"}</p><p className="font-medium">{e.registrationTypes.length?`A partir de ${formatEventMoney(Math.min(...e.registrationTypes.map(t=>Number(t.price))))}`:formatEventMoney(e.defaultPrice)}</p></CardContent></Card></Link>)}</div>
    {!events.length&&<div className="rounded-xl border p-10 text-center text-muted-foreground">Não há eventos públicos disponíveis no momento.</div>}
  </main>;
}
