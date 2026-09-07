import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckinQr } from "@/components/events/checkin-qr";

export default async function CredentialPage({ params }: { params: Promise<{ token: string }> }) {
  const {token}=await params; const p=await prisma.eventParticipant.findUnique({where:{publicToken:token},include:{registration:{include:{event:true}},registrationType:true}}); if(!p)notFound();
  const appUrl=process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000";
  return <main className="min-h-screen bg-muted/30 p-4 py-8"><Card className="mx-auto max-w-md"><CardHeader><CardTitle>Credencial do participante</CardTitle></CardHeader><CardContent className="space-y-5 text-center"><div><h1 className="text-xl font-bold">{p.name}</h1><p className="text-sm text-muted-foreground">{p.registration.event.name}</p><p className="text-sm text-muted-foreground">{p.registrationType?.name??"Inscrição padrão"}</p></div><CheckinQr token={p.publicToken} appUrl={appUrl}/><p className="text-xs text-muted-foreground">Apresente este QR Code à equipe do evento. A leitura abre uma confirmação protegida no painel administrativo.</p></CardContent></Card></main>;
}
