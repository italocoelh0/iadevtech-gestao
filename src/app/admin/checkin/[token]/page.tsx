import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkInParticipant, reverseCheckIn } from "@/app/admin/eventos/checkin-actions";

export default async function CheckinTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const session=await requirePermission(PERMISSIONS.EVENTS_OPERATION); const {token}=await params;
  const participant=await prisma.eventParticipant.findUnique({where:{publicToken:token},include:{registration:{include:{event:true}},registrationType:true,checkins:{where:{status:"CHECKED_IN"},take:1}}}); if(!participant)notFound();
  const checked=participant.checkins.length>0; const can=hasPermission(session.user.roles,PERMISSIONS.EVENTS_CHECKIN);
  return <div className="mx-auto max-w-xl space-y-6"><Link href={`/admin/eventos/${participant.registration.eventId}/operacao`} className="text-sm text-muted-foreground underline">← Painel do evento</Link><Card><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>Check-in</CardTitle><Badge>{checked?"Presente":"Pendente"}</Badge></div></CardHeader><CardContent className="space-y-4"><div><p className="text-sm text-muted-foreground">Participante</p><p className="text-xl font-semibold">{participant.name}</p></div><div className="text-sm"><p><strong>Evento:</strong> {participant.registration.event.name}</p><p><strong>Tipo:</strong> {participant.registrationType?.name??"Padrão"}</p><p><strong>Inscrição:</strong> {participant.registration.status}</p></div>{can&&(checked?<form action={reverseCheckIn.bind(null,participant.id)}><Button type="submit" variant="outline" className="w-full">Reverter check-in</Button></form>:<form action={checkInParticipant.bind(null,participant.id)}><Button type="submit" className="w-full">Confirmar check-in</Button></form>)}</CardContent></Card></div>;
}
