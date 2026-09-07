import Link from "next/link";
import { AlertTriangle, CalendarDays, CircleDollarSign, Package, Receipt, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/reports/data";
import { money, percentage } from "@/lib/reports/utils";

export default async function AdminDashboardPage() {
  const data = await getDashboardData();
  const feeRate = percentage(data.fees.paidCount, data.fees.paidCount + data.fees.pendingCount);
  const stats = [
    { title: "Membros ativos", value: String(data.membersActive), description: "Cadastro ativo", icon: Users },
    { title: "Receitas do mês", value: money(data.financial.income), description: `Resultado ${money(data.financial.balance)}`, icon: TrendingUp },
    { title: "Mensalidades recebidas", value: money(data.fees.paidAmount), description: `${feeRate}% das mensalidades pagas`, icon: Receipt },
    { title: "Comandas em aberto", value: String(data.orders.openCount), description: `${money(data.orders.openAmount)} em comandas abertas`, icon: ShoppingCart },
  ];

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Dashboard</h1><p className="text-muted-foreground">Indicadores consolidados da operação no mês atual.</p></div><Link href="/admin/relatorios"><Button variant="outline">Abrir relatórios</Button></Link></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat)=>{const Icon=stat.icon;return <Card key={stat.title}><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{stat.title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{stat.value}</div><CardDescription className="mt-1">{stat.description}</CardDescription></CardContent></Card>})}</div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5"/>Próximos eventos</CardTitle><CardDescription>Eventos previstos para os próximos 60 dias.</CardDescription></CardHeader><CardContent className="space-y-3">{data.upcomingEvents.map((event)=><Link key={event.id} href={`/admin/eventos/${event.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"><div><p className="font-medium">{event.name}</p><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(event.startsAt)}</p></div><span className="text-xs text-muted-foreground">{event.capacity ? `${event.capacity} vagas` : "Sem limite"}</span></Link>)}{!data.upcomingEvents.length&&<p className="text-sm text-muted-foreground">Nenhum evento próximo.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5"/>Estoque baixo</CardTitle><CardDescription>Produtos no mínimo ou abaixo do estoque recomendado.</CardDescription></CardHeader><CardContent className="space-y-3">{data.lowStock.map((product)=><Link key={product.id} href="/admin/estoque" className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"><div><p className="font-medium">{product.name}</p><p className="text-xs text-muted-foreground">Mínimo: {product.minimum.toLocaleString("pt-BR")}</p></div><span className="font-semibold">{product.balance.toLocaleString("pt-BR")}</span></Link>)}{!data.lowStock.length&&<div className="flex items-center gap-2 text-sm text-muted-foreground"><Package className="h-4 w-4"/>Nenhum alerta de estoque.</div>}</CardContent></Card>
    </div>
    <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle className="text-sm">Despesas do mês</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{money(data.financial.expense)}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Mensalidades pendentes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{money(data.fees.pendingAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{data.fees.pendingCount} lançamento(s)</p></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Resultado financeiro</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{money(data.financial.balance)}</div><p className="mt-1 text-xs text-muted-foreground"><CircleDollarSign className="mr-1 inline h-3.5 w-3.5"/>mês atual</p></CardContent></Card></div>
  </div>;
}
