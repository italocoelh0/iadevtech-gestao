import Link from "next/link";
import { CalendarDays, ClipboardPlus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
    <div className="max-w-2xl text-center">
      <h1 className="text-4xl font-bold tracking-tight">Gestão de Empresa</h1>
      <p className="mt-4 text-lg text-muted-foreground">Eventos, membros, mensalidades, financeiro, estoque e comandas em uma única plataforma.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/comanda/abrir"><Button><ClipboardPlus className="mr-2 h-4 w-4"/>Abrir comanda avulsa</Button></Link><Link href="/eventos"><Button variant="secondary"><CalendarDays className="mr-2 h-4 w-4"/>Ver eventos</Button></Link><Link href="/login"><Button variant="outline"><ShieldCheck className="mr-2 h-4 w-4"/>Área administrativa</Button></Link></div>
    </div>
  </main>;
}
