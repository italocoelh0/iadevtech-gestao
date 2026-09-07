import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, BadgeDollarSign, CircleCheck, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { competencyLabel, dateInputValue, formatCurrency } from "@/lib/fees/utils";
import { cancelFee, exemptFee, registerFeePayment } from "../actions";

const labels: Record<string,string> = { PENDING:"Pendente", PAID:"Pago", CANCELED:"Cancelado", EXEMPT:"Isento" };

export default async function FeeDetailPage({ params, searchParams }: { params: Promise<{ id:string }>; searchParams: Promise<{ paid?:string; exempt?:string; canceled?:string; created?:string; error?:string }> }) {
  const session = await requirePermission(PERMISSIONS.FEES_VIEW);
  const { id } = await params;
  const query = await searchParams;
  const [fee, paymentMethods] = await Promise.all([
    prisma.membershipFee.findUnique({ where: { id }, include: { member: true, paymentMethod: true, createdBy: { select: { name:true, email:true } }, cashTransactions: { orderBy: { occurredAt:"desc" }, include: { category:true, paymentMethod:true } } } }),
    prisma.paymentMethod.findMany({ where: { active:true }, orderBy: { name:"asc" } }),
  ]);
  if (!fee) notFound();
  const canPay = hasPermission(session.user.roles, PERMISSIONS.FEES_PAY) && fee.status === "PENDING";
  const canExempt = hasPermission(session.user.roles, PERMISSIONS.FEES_EXEMPT) && fee.status === "PENDING";
  const canCancel = hasPermission(session.user.roles, PERMISSIONS.FEES_CANCEL) && fee.status !== "CANCELED";
  const today = dateInputValue(new Date());

  return <div className="mx-auto max-w-5xl space-y-6">
    <div><Link href={`/admin/mensalidades?year=${fee.competencyYear}&month=${fee.competencyMonth}`} className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4"/>Voltar</Link><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{fee.member.fullName}</h1><Badge>{labels[fee.status]}</Badge>{fee.status==="PAID"&&<a href={`/api/recibos/mensalidade/${fee.id}`} target="_blank" className="text-sm font-medium underline">Recibo PDF</a>}</div><p className="text-muted-foreground">Mensalidade de {competencyLabel(fee.competencyYear, fee.competencyMonth)}</p></div>
    {(query.paid || query.exempt || query.canceled || query.created) && <div className="rounded-md border bg-card p-3 text-sm">Operação concluída com sucesso.</div>}
    {query.error && <div className="rounded-md border p-3 text-sm">Não foi possível concluir: {query.error}.</div>}

    <div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Detalhes</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Item label="Competência" value={competencyLabel(fee.competencyYear, fee.competencyMonth)}/><Item label="Valor" value={formatCurrency(fee.amount.toString())}/><Item label="Vencimento" value={fee.dueDate ? new Intl.DateTimeFormat("pt-BR").format(fee.dueDate):"—"}/><Item label="Pagamento" value={fee.paidAt ? new Intl.DateTimeFormat("pt-BR").format(fee.paidAt):"—"}/><Item label="Forma" value={fee.paymentMethod?.name ?? "—"}/><Item label="Criado por" value={fee.createdBy?.name ?? "Sistema"}/></CardContent></Card><Card><CardHeader><CardTitle>Membro</CardTitle></CardHeader><CardContent className="space-y-4"><Item label="Nome" value={fee.member.fullName}/><Item label="Telefone" value={fee.member.phone}/><Item label="E-mail" value={fee.member.email}/><Link href={`/admin/membros/${fee.member.id}`} className="inline-block text-sm font-medium hover:underline">Abrir cadastro do membro</Link></CardContent></Card></div>

    {fee.notes && <Card><CardHeader><CardTitle>Observações</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{fee.notes}</p></CardContent></Card>}

    {(canPay || canExempt || canCancel) && <div className="grid gap-4 xl:grid-cols-3">
      {canPay && <Card><CardHeader><CardTitle className="flex items-center gap-2"><CircleCheck className="h-5 w-5"/>Registrar pagamento</CardTitle><CardDescription>O recebimento gera automaticamente uma entrada financeira.</CardDescription></CardHeader><CardContent><form action={registerFeePayment.bind(null, fee.id)} className="space-y-3"><select name="paymentMethodId" required className="input"><option value="">Forma de pagamento</option>{paymentMethods.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input name="paidAt" type="date" defaultValue={today} required className="input"/><textarea name="notes" rows={2} placeholder="Observação opcional" className="w-full rounded-md border bg-background p-3 text-sm"/><Button type="submit" className="w-full"><BadgeDollarSign className="mr-2 h-4 w-4"/>Confirmar pagamento</Button></form></CardContent></Card>}
      {canExempt && <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Isentar</CardTitle><CardDescription>Registra a isenção sem excluir o lançamento.</CardDescription></CardHeader><CardContent><form action={exemptFee.bind(null, fee.id)} className="space-y-3"><textarea name="reason" rows={4} required placeholder="Motivo da isenção" className="w-full rounded-md border bg-background p-3 text-sm"/><Button type="submit" variant="secondary" className="w-full">Conceder isenção</Button></form></CardContent></Card>}
      {canCancel && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Ban className="h-5 w-5"/>Cancelar</CardTitle><CardDescription>Se houver pagamento, cria um lançamento de estorno no financeiro.</CardDescription></CardHeader><CardContent><form action={cancelFee.bind(null, fee.id)} className="space-y-3"><textarea name="reason" rows={4} required placeholder="Motivo do cancelamento" className="w-full rounded-md border bg-background p-3 text-sm"/><Button type="submit" variant="outline" className="w-full">Cancelar mensalidade</Button></form></CardContent></Card>}
    </div>}

    <Card><CardHeader><CardTitle>Movimentações financeiras</CardTitle><CardDescription>Histórico vinculado diretamente a esta mensalidade.</CardDescription></CardHeader><CardContent>{fee.cashTransactions.length===0?<p className="text-sm text-muted-foreground">Nenhuma movimentação vinculada.</p>:<div className="space-y-3">{fee.cashTransactions.map((tx)=><div key={tx.id} className="flex flex-col justify-between gap-2 rounded-md border p-3 sm:flex-row"><div><p className="text-sm font-medium">{tx.description}</p><p className="text-xs text-muted-foreground">{tx.category.name} · {tx.paymentMethod?.name ?? "Sem forma"}</p></div><div className="text-sm font-semibold">{tx.type === "REVERSAL" ? "- " : "+ "}{formatCurrency(tx.amount.toString())}</div></div>)}</div>}</CardContent></Card>
  </div>;
}

function Item({label,value}:{label:string;value?:string|null}) { return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm">{value || "—"}</p></div>; }
