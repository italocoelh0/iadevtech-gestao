import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { monthNames } from "@/lib/fees/utils";
import { createManualFee } from "../actions";

export default async function NewFeePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePermission(PERMISSIONS.FEES_CREATE);
  const params = await searchParams;
  const now = new Date();
  const [members, settings] = await Promise.all([
    prisma.member.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.systemSetting.findMany({ where: { key: { in: ["membership_fee.default_amount", "membership_fee.due_day"] } } }),
  ]);
  const amount = settings.find((x) => x.key === "membership_fee.default_amount")?.value ?? "50.00";
  const dueDay = Number(settings.find((x) => x.key === "membership_fee.due_day")?.value ?? 10);
  const yyyy = now.getFullYear();
  const mm = now.getMonth() + 1;
  const dueDate = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><Link href="/admin/mensalidades" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4"/>Voltar</Link><h1 className="text-2xl font-bold">Lançar mensalidade</h1><p className="text-muted-foreground">Crie um lançamento individual para um membro.</p></div>
    {params.error && <div className="rounded-md border p-3 text-sm">Dados inválidos. Revise o formulário.</div>}
    <Card><CardHeader><CardTitle>Novo lançamento</CardTitle><CardDescription>Não é permitido duplicar membro, ano e mês.</CardDescription></CardHeader><CardContent>
      <form action={createManualFee} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm sm:col-span-2"><span className="font-medium">Membro</span><select name="memberId" required className="input"><option value="">Selecione</option>{members.map((m)=><option key={m.id} value={m.id}>{m.fullName}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Ano</span><input className="input" name="year" type="number" defaultValue={yyyy} required/></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Mês</span><select className="input" name="month" defaultValue={mm}>{monthNames.map((m,i)=><option value={i+1} key={m}>{m}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Valor</span><input className="input" name="amount" type="number" step="0.01" defaultValue={amount} required/></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Vencimento</span><input className="input" name="dueDate" type="date" defaultValue={dueDate}/></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="font-medium">Observações</span><textarea name="notes" rows={4} className="w-full rounded-md border bg-background p-3 text-sm"/></label>
        <div className="sm:col-span-2"><Button type="submit">Criar mensalidade</Button></div>
      </form>
    </CardContent></Card>
  </div>;
}
