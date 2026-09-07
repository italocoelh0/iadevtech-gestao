import { ExportButtons } from "@/components/admin/export-buttons";
import { ArrowDownCircle, ArrowUpCircle, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { getFinanceReport } from "@/lib/reports/data";
import { money } from "@/lib/reports/utils";

export default async function FinanceReportPage({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}) {
  await requirePermission(PERMISSIONS.REPORTS_VIEW);
  const params=await searchParams; const report=await getFinanceReport(params.from,params.to); const exportUrl=`/api/export/financeiro?from=${report.start.toISOString().slice(0,10)}&to=${report.end.toISOString().slice(0,10)}`;
  const maxCategory=Math.max(1,...report.categories.map(c=>c.amount));
  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Relatório financeiro</h1><p className="text-muted-foreground">Consolidado de receitas e despesas por período.</p></div><ExportButtons baseUrl={exportUrl}/></div>
  <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[180px_180px_auto]"><input className="input" type="date" name="from" defaultValue={report.start.toISOString().slice(0,10)}/><input className="input" type="date" name="to" defaultValue={report.end.toISOString().slice(0,10)}/><Button type="submit">Aplicar período</Button></form>
  <div className="grid gap-4 md:grid-cols-3"><Stat title="Receitas" value={money(report.summary.income)} icon={<ArrowUpCircle className="h-4 w-4"/>}/><Stat title="Despesas" value={money(report.summary.expense)} icon={<ArrowDownCircle className="h-4 w-4"/>}/><Stat title="Resultado" value={money(report.summary.balance)} icon={<Landmark className="h-4 w-4"/>}/></div>
  <Card><CardHeader><CardTitle>Por categoria</CardTitle></CardHeader><CardContent className="space-y-4">{report.categories.map(c=><div key={`${c.name}-${c.type}`}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{c.name} · {c.type==="INCOME"?"Receita":"Despesa"}</span><span className="font-medium">{money(c.amount)}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:`${Math.max(2,c.amount/maxCategory*100)}%`}}/></div></div>)}{!report.categories.length&&<p className="text-sm text-muted-foreground">Sem movimentações no período.</p>}</CardContent></Card>
  <Card><CardHeader><CardTitle>Por forma de pagamento</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-y bg-muted/50 text-left"><tr><th className="px-3 py-2">Forma</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2 text-right">Lançamentos</th><th className="px-3 py-2 text-right">Valor</th></tr></thead><tbody>{report.methods.map((m,i)=><tr key={`${m.name}-${m.type}-${i}`} className="border-b"><td className="px-3 py-2">{m.name}</td><td className="px-3 py-2">{m.type==="INCOME"?"Receita":"Despesa"}</td><td className="px-3 py-2 text-right">{m.count}</td><td className="px-3 py-2 text-right font-medium">{money(m.amount)}</td></tr>)}</tbody></table></div></CardContent></Card></div>
}
function Stat({title,value,icon}:{title:string;value:string;icon:React.ReactNode}){return <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm">{title}{icon}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>}
