import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function OrdersPublicHome(){
 const events=await prisma.event.findMany({where:{isPublic:true,status:{in:["PUBLISHED","REGISTRATIONS_OPEN","REGISTRATIONS_CLOSED","IN_PROGRESS"]}},orderBy:{startsAt:"asc"},take:20,select:{id:true,slug:true,name:true,startsAt:true}});
 return <main className="min-h-screen bg-muted/30 p-4"><div className="mx-auto max-w-2xl space-y-4 py-10"><div><h1 className="text-3xl font-bold">Comandas</h1><p className="text-muted-foreground">Abra uma comanda para evento, reunião ou consumo avulso.</p></div>
 <Card className="border-primary/30"><CardHeader><CardTitle>Reunião / consumo sem evento</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-muted-foreground">Use esta opção para reuniões, encontros internos ou qualquer consumo que não pertença a um evento cadastrado.</span><Link href="/comanda/abrir"><Button>Abrir comanda avulsa</Button></Link></CardContent></Card>
 {events.length>0&&<div className="pt-2"><h2 className="mb-3 text-lg font-semibold">Eventos disponíveis</h2><div className="space-y-3">{events.map(e=><Card key={e.id}><CardHeader><CardTitle>{e.name}</CardTitle></CardHeader><CardContent className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(e.startsAt)}</span><Link href={`/comanda/abrir?evento=${e.slug}`}><Button variant="secondary">Abrir no evento</Button></Link></CardContent></Card>)}</div></div>}
 </div></main>;
}
