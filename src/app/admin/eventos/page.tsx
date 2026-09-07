import Link from "next/link";
import { EventStatus, Prisma } from "@prisma/client";
import { CalendarDays, Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_STATUS_LABELS, formatEventDate, formatEventMoney } from "@/lib/events/utils";

export default async function EventsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.EVENTS_VIEW);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = Object.values(EventStatus).includes(params.status as EventStatus) ? params.status as EventStatus : undefined;
  const page = Math.max(Number(params.page) || 1, 1);
  const pageSize = 20;
  const where: Prisma.EventWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { city: { contains: q } }, { location: { contains: q } }] } : {}),
  };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: { _count: { select: { registrations: true, orders: true } } },
      orderBy: [{ startsAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.event.count({ where }),
  ]);
  const pages = Math.max(Math.ceil(total / pageSize), 1);

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-bold tracking-tight">Eventos</h1><p className="text-muted-foreground">Cadastre, publique e acompanhe eventos.</p></div>
      {hasPermission(session.user.roles, PERMISSIONS.EVENTS_CREATE) && <Link href="/admin/eventos/novo"><Button><Plus className="mr-2 h-4 w-4"/>Novo evento</Button></Link>}
    </div>
    <Card><CardHeader><CardTitle>Eventos cadastrados</CardTitle></CardHeader><CardContent>
      <form className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px_auto]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input className="input pl-9" name="q" defaultValue={q} placeholder="Nome, local ou cidade"/></div>
        <select className="input" name="status" defaultValue={status ?? ""}><option value="">Todos os status</option>{Object.values(EventStatus).map(s=><option key={s} value={s}>{EVENT_STATUS_LABELS[s]}</option>)}</select>
        <Button type="submit" variant="secondary">Filtrar</Button>
      </form>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-y bg-muted/50 text-left"><tr><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Inscrições</th><th className="px-4 py-3">Valor padrão</th><th></th></tr></thead><tbody>
        {events.map(e=><tr key={e.id} className="border-b"><td className="px-4 py-3"><div className="font-medium">{e.name}</div><div className="text-xs text-muted-foreground">{[e.location,e.city].filter(Boolean).join(" • ") || "Local não informado"}</div></td><td className="px-4 py-3">{formatEventDate(e.startsAt)}</td><td className="px-4 py-3"><Badge>{EVENT_STATUS_LABELS[e.status]}</Badge></td><td className="px-4 py-3">{e._count.registrations}{e.capacity ? ` / ${e.capacity}` : ""}</td><td className="px-4 py-3">{formatEventMoney(e.defaultPrice)}</td><td className="px-4 py-3 text-right"><Link className="font-medium hover:underline" href={`/admin/eventos/${e.id}`}>Abrir</Link></td></tr>)}
        {!events.length&&<tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhum evento encontrado.</td></tr>}
      </tbody></table></div>
      <div className="mt-4 flex items-center justify-between text-sm"><span className="text-muted-foreground">Página {page} de {pages}</span><div className="flex gap-2">{page>1&&<Link href={`?page=${page-1}`}><Button size="sm" variant="outline">Anterior</Button></Link>}{page<pages&&<Link href={`?page=${page+1}`}><Button size="sm" variant="outline">Próxima</Button></Link>}</div></div>
    </CardContent></Card>
  </div>;
}
