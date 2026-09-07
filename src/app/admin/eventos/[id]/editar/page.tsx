import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EventForm } from "@/components/events/event-form";
import { updateEvent } from "@/app/admin/eventos/actions";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function localDateTime(date: Date | null) {
  if (!date) return "";
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0,16);
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.EVENTS_UPDATE);
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();
  const action = updateEvent.bind(null, id);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Editar evento</h1><p className="text-muted-foreground">{event.name}</p></div><Card><CardHeader><CardTitle>Dados do evento</CardTitle></CardHeader><CardContent><EventForm action={action} submitLabel="Salvar alterações" initialValues={{
    name:event.name, slug:event.slug, description:event.description, coverImageUrl:event.coverImageUrl,
    startsAt:localDateTime(event.startsAt), endsAt:localDateTime(event.endsAt), location:event.location, address:event.address, city:event.city, state:event.state,
    registrationOpensAt:localDateTime(event.registrationOpensAt), registrationClosesAt:localDateTime(event.registrationClosesAt),
    capacity:event.capacity, defaultPrice:event.defaultPrice.toString(), isPublic:event.isPublic, allowMembers:event.allowMembers,
    allowNonMembers:event.allowNonMembers, allowCompanions:event.allowCompanions, allowGroupRegistration:event.allowGroupRegistration, notes:event.notes
  }}/></CardContent></Card></div>;
}
