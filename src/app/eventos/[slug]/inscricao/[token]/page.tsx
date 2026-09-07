import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { PixManual } from "@/components/registrations/pix-manual";
import { money, REGISTRATION_STATUS_LABELS } from "@/lib/registrations/utils";

export default async function RegistrationResultPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const registration = await prisma.eventRegistration.findFirst({ where: { publicToken: token, event: { slug } }, include: { event: true, participants: { include: { registrationType: true } }, benefitApprovals: true, payments: { include: { paymentMethod: true }, orderBy: { createdAt: "desc" } } } });
  if (!registration) notFound();
  const pix = await prisma.systemSetting.findUnique({ where: { key: "pix.key" } });
  const showPix = Number(registration.finalAmount) > 0 && (registration.status === "AWAITING_PAYMENT" || registration.status === "PENDING") && pix?.value;
  return <main className="min-h-screen bg-muted/30 p-4 py-8 md:p-8"><div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_340px]"><Card><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>{registration.event.name}</CardTitle><Badge>{REGISTRATION_STATUS_LABELS[registration.status]}</Badge></div></CardHeader><CardContent className="space-y-5"><div><p className="text-sm text-muted-foreground">Responsável</p><p className="font-medium">{registration.name}</p><p className="text-sm text-muted-foreground">{registration.phone}</p></div><div><p className="mb-2 text-sm font-medium">Participantes</p><div className="space-y-2">{registration.participants.map(p=><div key={p.id} className="flex justify-between gap-4 rounded-md border p-3 text-sm"><span>{p.name}<span className="block text-xs text-muted-foreground">{p.registrationType?.name ?? "Inscrição padrão"}</span></span><span className="text-right"><strong>{money(p.finalAmount)}</strong><Link href={`/credencial/${p.publicToken}`} className="mt-1 block text-xs underline">Abrir credencial</Link></span></div>)}</div></div>{registration.benefitApprovals.some(b=>b.status==="PENDING")&&<div className="rounded-md border p-3 text-sm">Há uma solicitação de benefício aguardando análise.</div>}<div className="border-t pt-4"><div className="flex justify-between"><span>Total</span><strong className="text-lg">{money(registration.finalAmount)}</strong></div></div></CardContent></Card><aside>{showPix?<Card><CardHeader><CardTitle>Pagamento via PIX</CardTitle></CardHeader><CardContent><PixManual pixKey={pix.value}/></CardContent></Card>:<Card><CardHeader><CardTitle>Situação</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{registration.status==="PAID"?"Pagamento confirmado.":registration.status==="EXEMPT"?"Inscrição isenta de pagamento.":registration.status==="WAITLIST"?"Inscrição registrada na lista de espera.":"Não há pagamento PIX pendente neste momento."}</CardContent></Card>}</aside></div></main>;
}
