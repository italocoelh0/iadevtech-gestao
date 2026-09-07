import type React from "react";
import Link from "next/link";
import { FeeStatus, Prisma } from "@prisma/client";
import { CalendarRange, CircleDollarSign, Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { competencyLabel, formatCurrency, monthNames } from "@/lib/fees/utils";
import { generateMonthlyFees, saveDefaultFeeSettings } from "./actions";

const labels: Record<FeeStatus, string> = { PENDING: "Pendente", PAID: "Pago", CANCELED: "Cancelado", EXEMPT: "Isento" };

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; year?: string; month?: string; page?: string; generated?: string; settings?: string; error?: string }> }) {
  const session = await requirePermission(PERMISSIONS.FEES_VIEW);
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Math.min(Math.max(Number(params.month) || now.getMonth() + 1, 1), 12);
  const q = params.q?.trim() ?? "";
  const status = Object.values(FeeStatus).includes(params.status as FeeStatus) ? params.status as FeeStatus : undefined;
  const page = Math.max(Number(params.page) || 1, 1);
  const pageSize = 25;

  const where: Prisma.MembershipFeeWhereInput = {
    competencyYear: year, competencyMonth: month,
    ...(status ? { status } : {}),
    ...(q ? { member: { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] } } : {}),
  };

  const [fees, total, sums, activeMembers, settings] = await Promise.all([
    prisma.membershipFee.findMany({ where, include: { member: { select: { fullName: true, phone: true } }, paymentMethod: { select: { name: true } } }, orderBy: { member: { fullName: "asc" } }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.membershipFee.count({ where }),
    prisma.membershipFee.groupBy({ by: ["status"], where: { competencyYear: year, competencyMonth: month }, _sum: { amount: true }, _count: true }),
    prisma.member.count({ where: { status: "ACTIVE" } }),
    prisma.systemSetting.findMany({ where: { key: { in: ["membership_fee.default_amount", "membership_fee.due_day"] } } }),
  ]);

  const getSum = (s: FeeStatus) => Number(sums.find((x) => x.status === s)?._sum.amount ?? 0);
  const getCount = (s: FeeStatus) => sums.find((x) => x.status === s)?._count ?? 0;
  const projected = getSum("PENDING") + getSum("PAID");
  const defaultAmount = settings.find((x) => x.key === "membership_fee.default_amount")?.value ?? "50.00";
  const dueDay = settings.find((x) => x.key === "membership_fee.due_day")?.value ?? "10";
  const delinquencyBase = getCount("PENDING") + getCount("PAID");
  const delinquencyRate = delinquencyBase ? (getCount("PENDING") / delinquencyBase) * 100 : 0;
  const canManage = hasPermission(session.user.roles, PERMISSIONS.FEES_GENERATE);
  const canCreate = hasPermission(session.user.roles, PERMISSIONS.FEES_CREATE);
  const pages = Math.max(Math.ceil(total / pageSize), 1);

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div><h1 className="text-2xl font-bold tracking-tight">Mensalidades</h1><p className="text-muted-foreground">Competência, recebimentos, isenções e inadimplência dos membros.</p></div>
      {canCreate && <Link href="/admin/mensalidades/novo"><Button><Plus className="mr-2 h-4 w-4"/>Lançar mensalidade</Button></Link>}
    </div>

    {params.generated !== undefined && <div className="rounded-md border bg-card p-3 text-sm">Geração concluída: {params.generated} nova(s) mensalidade(s).</div>}
    {params.settings && <div className="rounded-md border bg-card p-3 text-sm">Configurações de mensalidade atualizadas.</div>}
    {params.error && <div className="rounded-md border p-3 text-sm">Não foi possível concluir a operação: {params.error}.</div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Stat title="Previsto" value={formatCurrency(projected)} note={`${getCount("PENDING") + getCount("PAID")} lançamentos`} />
      <Stat title="Recebido" value={formatCurrency(getSum("PAID"))} note={`${getCount("PAID")} pagos`} />
      <Stat title="Pendente" value={formatCurrency(getSum("PENDING"))} note={`${getCount("PENDING")} pendentes`} />
      <Stat title="Inadimplência" value={`${delinquencyRate.toFixed(1)}%`} note="entre cobranças pagas e pendentes" />
      <Stat title="Cobertura" value={`${total}/${activeMembers}`} note="lançamentos / membros ativos" />
    </div>

    {canManage && <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Gerar competência</CardTitle><CardDescription>Cria somente mensalidades inexistentes para membros ativos.</CardDescription></CardHeader><CardContent><form action={generateMonthlyFees} className="grid gap-3 sm:grid-cols-4"><Field label="Ano"><input name="year" type="number" defaultValue={year} className="input"/></Field><Field label="Mês"><select name="month" defaultValue={month} className="input">{monthNames.map((m,i)=><option value={i+1} key={m}>{m}</option>)}</select></Field><Field label="Valor"><input name="amount" type="number" step="0.01" defaultValue={defaultAmount} className="input"/></Field><Field label="Vencimento"><input name="dueDay" type="number" min="1" max="28" defaultValue={dueDay} className="input"/></Field><div className="sm:col-span-4"><Button type="submit"><CalendarRange className="mr-2 h-4 w-4"/>Gerar mensalidades</Button></div></form></CardContent></Card>
      <Card><CardHeader><CardTitle>Configuração padrão</CardTitle><CardDescription>Valores sugeridos para próximas gerações.</CardDescription></CardHeader><CardContent><form action={saveDefaultFeeSettings} className="grid gap-3 sm:grid-cols-2"><Field label="Valor padrão"><input name="amount" type="number" step="0.01" defaultValue={defaultAmount} className="input"/></Field><Field label="Dia do vencimento"><input name="dueDay" type="number" min="1" max="28" defaultValue={dueDay} className="input"/></Field><div className="sm:col-span-2"><Button type="submit" variant="secondary">Salvar configuração</Button></div></form></CardContent></Card>
    </div>}

    <Card><CardHeader><CardTitle>{competencyLabel(year, month)}</CardTitle><CardDescription>Visão mensal em grade.</CardDescription></CardHeader><CardContent>
      <form className="mb-5 grid gap-3 md:grid-cols-[1fr_150px_180px_140px_auto]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input name="q" defaultValue={q} className="input pl-9" placeholder="Nome, telefone ou e-mail"/></div><input name="year" type="number" defaultValue={year} className="input"/><select name="month" defaultValue={month} className="input">{monthNames.map((m,i)=><option value={i+1} key={m}>{m}</option>)}</select><select name="status" defaultValue={status ?? ""} className="input"><option value="">Todos</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><Button type="submit" variant="secondary">Filtrar</Button></form>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-y bg-muted/50 text-left"><tr><th className="px-4 py-3">Membro</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Pagamento</th><th className="px-4 py-3"></th></tr></thead><tbody>{fees.map((fee)=><tr key={fee.id} className="border-b last:border-0"><td className="px-4 py-3"><div className="font-medium">{fee.member.fullName}</div><div className="text-xs text-muted-foreground">{fee.member.phone || "—"}</div></td><td className="px-4 py-3">{formatCurrency(fee.amount.toString())}</td><td className="px-4 py-3">{fee.dueDate ? new Intl.DateTimeFormat("pt-BR").format(fee.dueDate) : "—"}</td><td className="px-4 py-3"><Badge>{labels[fee.status]}</Badge></td><td className="px-4 py-3">{fee.paymentMethod?.name ?? "—"}</td><td className="px-4 py-3 text-right"><Link href={`/admin/mensalidades/${fee.id}`} className="font-medium hover:underline">Abrir</Link></td></tr>)}{fees.length===0&&<tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhuma mensalidade encontrada.</td></tr>}</tbody></table></div>
      <div className="mt-4 flex items-center justify-between text-sm"><span className="text-muted-foreground">Página {page} de {pages}</span><div className="flex gap-2">{page>1&&<Link href={`?year=${year}&month=${month}&status=${status??""}&q=${encodeURIComponent(q)}&page=${page-1}`}><Button size="sm" variant="outline">Anterior</Button></Link>}{page<pages&&<Link href={`?year=${year}&month=${month}&status=${status??""}&q=${encodeURIComponent(q)}&page=${page+1}`}><Button size="sm" variant="outline">Próxima</Button></Link>}</div></div>
    </CardContent></Card>
  </div>;
}

function Stat({ title, value, note }: { title:string; value:string; note:string }) { return <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm">{title}<CircleDollarSign className="h-4 w-4 text-muted-foreground"/></CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent></Card>; }
function Field({ label, children }: { label:string; children:React.ReactNode }) { return <label className="space-y-1 text-sm"><span className="font-medium">{label}</span>{children}</label>; }
