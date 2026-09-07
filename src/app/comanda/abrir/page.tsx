import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicOpenOrderForm } from "@/components/orders/public-open-form";

export default async function OpenOrderPage({ searchParams }: { searchParams: Promise<{ evento?: string }> }) {
  const { evento } = await searchParams;
  const event = evento ? await prisma.event.findFirst({
    where: { OR: [{ id: evento }, { slug: evento }], isPublic: true, status: { in: ["PUBLISHED", "REGISTRATIONS_OPEN", "REGISTRATIONS_CLOSED", "IN_PROGRESS"] } },
    select: { id: true, name: true, startsAt: true },
  }) : null;
  if (evento && !event) notFound();

  return <main className="min-h-screen bg-muted/30 p-4"><div className="mx-auto max-w-lg space-y-4 py-10">
    <Card><CardHeader><CardTitle>Abrir comanda</CardTitle><p className="text-sm text-muted-foreground">{event ? event.name : "Reunião ou consumo sem evento"}</p></CardHeader><CardContent><PublicOpenOrderForm eventId={event?.id}/><p className="mt-4 text-xs text-muted-foreground">Informe seu celular. Se já houver uma comanda aberta para esse número, ela será retomada automaticamente; caso contrário, uma nova será criada. Guarde o link para lançar consumos, acompanhar o total e fechar a comanda para pagamento.</p></CardContent></Card>
    <div className="text-center text-sm"><Link href="/comanda" className="text-muted-foreground underline">Voltar às opções de comanda</Link></div>
  </div></main>;
}
