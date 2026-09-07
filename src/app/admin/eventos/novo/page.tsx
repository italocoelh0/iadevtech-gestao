import Link from "next/link";
import { EventForm } from "@/components/events/event-form";
import { createEvent } from "@/app/admin/eventos/actions";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewEventPage() {
  await requirePermission(PERMISSIONS.EVENTS_CREATE);
  return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Novo evento</h1><p className="text-muted-foreground">Crie o evento como rascunho e publique quando estiver pronto.</p></div><Link href="/admin/eventos"><Button variant="outline">Voltar</Button></Link></div><Card><CardHeader><CardTitle>Dados do evento</CardTitle></CardHeader><CardContent><EventForm action={createEvent} submitLabel="Criar evento"/></CardContent></Card></div>;
}
