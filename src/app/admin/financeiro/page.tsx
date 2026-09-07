import Link from "next/link";
import { CashTransactionType, Prisma } from "@prisma/client";
import { ArrowDownCircle, ArrowUpCircle, Landmark, Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/finance/utils";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; category?: string; from?: string; to?: string; page?: string; error?: string }> }) {
  const session = await requirePermission(PERMISSIONS.FINANCE_VIEW);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const type = ["INCOME","EXPENSE","REVERSAL","ADJUSTMENT"].includes(params.type || "") ? params.type as CashTransactionType : undefined;
  const page = Math.max(Number(params.page) || 1, 1); const pageSize = 30;
  const from = params.from ? new Date(`${params.from}T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = params.to ? new Date(`${params.to}T23:59:59`) : new Date(new Date().getFullYear(), new Date().getMonth()+1, 0, 23,59,59);
  const where: Prisma.CashTransactionWhereInput = { occurredAt: { gte: from, lte: to }, ...(type ? { type } : {}), ...(params.category ? { categoryId: params.category } : {}), ...(q ? { description: { contains: q } } : {}) };
  const [items,total,categories,summary,reversals,openCash] = await Promise.all([
    prisma.cashTransaction.findMany({ where, include: { category:true, paymentMethod:true, event:{select:{name:true}}, createdBy:{select:{name:true}} }, orderBy:[{occurredAt:"desc"},{createdAt:"desc"}], skip:(page-1)*pageSize, take:pageSize }),
    prisma.cashTransaction.count({where}),
    prisma.cashCategory.findMany({orderBy:[{type:"asc"},{name:"asc"}]}),
    prisma.cashTransaction.groupBy({by:["type"], where:{occurredAt:{gte:from,lte:to}}, _sum:{amount:true}, _count:true}),
    prisma.cashTransaction.findMany({where:{occurredAt:{gte:from,lte:to},type:"REVERSAL"},select:{amount:true,metadata:true}}),
    prisma.cashRegister.findFirst({where:{status:"OPEN"},orderBy:{openedAt:"desc"}}),
  ]);
  const sum=(t:CashTransactionType)=>Number(summary.find(x=>x.type===t)?._sum.amount??0);
  const income=sum("INCOME"), expense=sum("EXPENSE");
  const reversalIncome = reversals.filter(x=>(x.metadata as {originalType?:string}|null)?.originalType==="INCOME").reduce((a,x)=>a+Number(x.amount),0);
  const reversalExpense = reversals.filter(x=>(x.metadata as {originalType?:string}|null)?.originalType==="EXPENSE").reduce((a,x)=>a+Number(x.amount),0);
  const balance=income-expense-reversalIncome+reversalExpense;
  const pages=Math.max(Math.ceil(total/pageSize),1);

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Financeiro</h1><p className="text-muted-foreground">Fluxo de caixa, receitas, despesas e estornos.</p></div><div className="flex flex-wrap gap-2">{hasPermission(session.user.roles,PERMISSIONS.FINANCE_CREATE)&&<Link href="/admin/financeiro/novo"><Button><Plus className="mr-2 h-4 w-4"/>Novo lançamento</Button></Link>}<Link href="/admin/financeiro/caixa"><Button variant="outline"><Landmark className="mr-2 h-4 w-4"/>{openCash?"Caixa aberto":"Abrir caixa"}</Button></Link>{hasPermission(session.user.roles,PERMISSIONS.FINANCE_SETTINGS)&&<Link href="/admin/financeiro/configuracoes"><Button variant="secondary">Configurações</Button></Link>}</div></div>
    {params.error&&<div className="rounded-md border p-3 text-sm">Não foi possível concluir a operação: {params.error}.</div>}
    <div className="grid gap-4 md:grid-cols-3"><Stat title="Receitas" value={formatMoney(income)} icon="up"/><Stat title="Despesas" value={formatMoney(expense)} icon="down"/><Stat title="Resultado do período" value={formatMoney(balance)} icon="balance"/></div>
    <Card><CardHeader><CardTitle>Extrato</CardTitle><CardDescription>Movimentações do período selecionado.</CardDescription></CardHeader><CardContent>
      <form className="mb-5 grid gap-3 lg:grid-cols-[1fr_150px_180px_150px_150px_auto]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input name="q" defaultValue={q} className="input pl-9" placeholder="Descrição"/></div><select name="type" defaultValue={type??""} className="input"><option value="">Todos</option><option value="INCOME">Receitas</option><option value="EXPENSE">Despesas</option><option value="REVERSAL">Estornos</option></select><select name="category" defaultValue={params.category??""} className="input"><option value="">Todas categorias</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input name="from" type="date" defaultValue={from.toISOString().slice(0,10)} className="input"/><input name="to" type="date" defaultValue={to.toISOString().slice(0,10)} className="input"/><Button type="submit" variant="secondary">Filtrar</Button></form>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-y bg-muted/50 text-left"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Forma</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Valor</th><th></th></tr></thead><tbody>{items.map(i=><tr key={i.id} className="border-b"><td className="px-4 py-3">{new Intl.DateTimeFormat("pt-BR").format(i.occurredAt)}</td><td className="px-4 py-3"><div className="font-medium">{i.description}</div>{i.event&&<div className="text-xs text-muted-foreground">{i.event.name}</div>}</td><td className="px-4 py-3">{i.category.name}</td><td className="px-4 py-3">{i.paymentMethod?.name??"—"}</td><td className="px-4 py-3"><Badge>{i.type==="INCOME"?"Receita":i.type==="EXPENSE"?"Despesa":"Estorno"}</Badge></td><td className="px-4 py-3 text-right font-medium">{formatMoney(i.amount.toString())}</td><td className="px-4 py-3 text-right"><Link href={`/admin/financeiro/${i.id}`} className="font-medium hover:underline">Abrir</Link></td></tr>)}{!items.length&&<tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhuma movimentação encontrada.</td></tr>}</tbody></table></div>
      <div className="mt-4 flex items-center justify-between text-sm"><span className="text-muted-foreground">Página {page} de {pages}</span><div className="flex gap-2">{page>1&&<Link href={`?page=${page-1}`}><Button size="sm" variant="outline">Anterior</Button></Link>}{page<pages&&<Link href={`?page=${page+1}`}><Button size="sm" variant="outline">Próxima</Button></Link>}</div></div>
    </CardContent></Card>
  </div>
}

function Stat({title,value,icon}:{title:string;value:string;icon:"up"|"down"|"balance"}) { const Icon=icon==="up"?ArrowUpCircle:icon==="down"?ArrowDownCircle:Landmark; return <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm">{title}<Icon className="h-4 w-4 text-muted-foreground"/></CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card> }
