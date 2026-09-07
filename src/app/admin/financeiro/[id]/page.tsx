import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/finance/utils";
import { reverseTransaction } from "../actions";

export default async function TransactionPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{created?:string;reversed?:string;error?:string}>}){
 const session=await requirePermission(PERMISSIONS.FINANCE_VIEW); const {id}=await params; const query=await searchParams;
 const tx=await prisma.cashTransaction.findUnique({where:{id},include:{category:true,paymentMethod:true,event:true,createdBy:{select:{name:true,email:true}},membershipFee:{include:{member:{select:{fullName:true}}}},reversalOf:true,reversals:true}}); if(!tx)notFound();
 const canReverse=hasPermission(session.user.roles,PERMISSIONS.FINANCE_REVERSE)&&!tx.reversedAt&&tx.type!=="REVERSAL";
 return <div className="mx-auto max-w-4xl space-y-6"><div><Link href="/admin/financeiro" className="text-sm text-muted-foreground hover:underline">← Voltar</Link><div className="mt-2 flex items-center gap-3"><h1 className="text-2xl font-bold">Movimentação financeira</h1><Badge>{tx.type==="INCOME"?"Receita":tx.type==="EXPENSE"?"Despesa":"Estorno"}</Badge></div></div>{query.created&&<div className="rounded-md border p-3 text-sm">Lançamento criado.</div>}{query.reversed&&<div className="rounded-md border p-3 text-sm">Estorno registrado.</div>}{query.error&&<div className="rounded-md border p-3 text-sm">Não foi possível concluir: {query.error}.</div>}<Card><CardContent className="grid gap-4 pt-6 sm:grid-cols-2"><Info l="Descrição" v={tx.description}/><Info l="Valor" v={formatMoney(tx.amount.toString())}/><Info l="Data" v={new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(tx.occurredAt)}/><Info l="Categoria" v={tx.category.name}/><Info l="Forma de pagamento" v={tx.paymentMethod?.name??"—"}/><Info l="Responsável" v={tx.createdBy?.name??"Automático"}/><Info l="Evento" v={tx.event?.name??"—"}/><Info l="Caixa" v={tx.cashRegisterId??"Não vinculado"}/>{tx.membershipFee&&<Info l="Origem" v={`Mensalidade — ${tx.membershipFee.member.fullName}`}/>}<Info l="Comprovante" v={tx.attachmentUrl??"—"}/>{tx.reversedAt&&<Info l="Estornada em" v={new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(tx.reversedAt)}/>}</CardContent></Card>{canReverse&&<Card><CardHeader><CardTitle>Estornar movimentação</CardTitle></CardHeader><CardContent><form action={reverseTransaction.bind(null,id)} className="flex flex-col gap-3 sm:flex-row"><input name="reason" className="input flex-1" placeholder="Motivo do estorno" required minLength={3}/><Button type="submit" variant="outline">Registrar estorno</Button></form></CardContent></Card>}</div>
}
function Info({l,v}:{l:string;v:string}){return <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{l}</div><div className="mt-1 text-sm font-medium break-words">{v}</div></div>}
