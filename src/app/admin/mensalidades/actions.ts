"use server";

import { AuditAction, CashTransactionType, FeeStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import {
  defaultFeeSettingsSchema,
  exemptionSchema,
  generateFeesSchema,
  manualFeeSchema,
  parseLocalDate,
  paymentSchema,
} from "@/lib/fees/schema";
import { withSerializableRetry } from "@/lib/server/transaction";

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function dueDateFor(year: number, month: number, dueDay: number) {
  return new Date(year, month - 1, dueDay, 12, 0, 0);
}

export async function saveDefaultFeeSettings(formData: FormData) {
  await requirePermission(PERMISSIONS.FEES_GENERATE);
  const parsed = defaultFeeSettingsSchema.safeParse({
    amount: formData.get("amount"),
    dueDay: formData.get("dueDay"),
  });
  if (!parsed.success) redirect("/admin/mensalidades?error=configuracao-invalida");

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: "membership_fee.default_amount" },
      update: { value: String(parsed.data.amount), valueType: "NUMBER", description: "Valor padrão da mensalidade." },
      create: { key: "membership_fee.default_amount", value: String(parsed.data.amount), valueType: "NUMBER", description: "Valor padrão da mensalidade." },
    }),
    prisma.systemSetting.upsert({
      where: { key: "membership_fee.due_day" },
      update: { value: String(parsed.data.dueDay), valueType: "NUMBER", description: "Dia padrão de vencimento da mensalidade." },
      create: { key: "membership_fee.due_day", value: String(parsed.data.dueDay), valueType: "NUMBER", description: "Dia padrão de vencimento da mensalidade." },
    }),
  ]);

  revalidatePath("/admin/mensalidades");
  redirect("/admin/mensalidades?settings=1");
}

export async function generateMonthlyFees(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.FEES_GENERATE);
  const parsed = generateFeesSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    amount: formData.get("amount"),
    dueDay: formData.get("dueDay"),
  });
  if (!parsed.success) redirect("/admin/mensalidades?error=geracao-invalida");

  const { year, month, amount, dueDay } = parsed.data;
  const members = await prisma.member.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  const existing = await prisma.membershipFee.findMany({
    where: { competencyYear: year, competencyMonth: month, memberId: { in: members.map((m) => m.id) } },
    select: { memberId: true },
  });
  const existingIds = new Set(existing.map((fee) => fee.memberId));
  const missing = members.filter((member) => !existingIds.has(member.id));

  if (missing.length) {
    await prisma.membershipFee.createMany({
      data: missing.map((member) => ({
        memberId: member.id,
        competencyYear: year,
        competencyMonth: month,
        amount: new Prisma.Decimal(amount),
        dueDate: dueDateFor(year, month, dueDay),
        status: FeeStatus.PENDING,
        createdById: session.user.id,
      })),
      skipDuplicates: true,
    });
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    action: AuditAction.CREATE,
    entityType: "MembershipFeeBatch",
    entityId: `${year}-${String(month).padStart(2, "0")}`,
    description: `${missing.length} mensalidade(s) gerada(s) para a competência ${month}/${year}.`,
    newData: { year, month, amount, dueDay, createdCount: missing.length, skippedCount: existing.length },
  });

  revalidatePath("/admin/mensalidades");
  redirect(`/admin/mensalidades?year=${year}&month=${month}&generated=${missing.length}`);
}

export async function createManualFee(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.FEES_CREATE);
  const parsed = manualFeeSchema.safeParse({
    memberId: formData.get("memberId"), year: formData.get("year"), month: formData.get("month"),
    amount: formData.get("amount"), dueDate: formData.get("dueDate"), notes: formData.get("notes"),
  });
  if (!parsed.success) redirect("/admin/mensalidades/novo?error=dados-invalidos");

  const data = parsed.data;
  const exists = await prisma.membershipFee.findUnique({
    where: { memberId_competencyYear_competencyMonth: { memberId: data.memberId, competencyYear: data.year, competencyMonth: data.month } },
  });
  if (exists) redirect(`/admin/mensalidades/${exists.id}?error=duplicada`);

  const fee = await prisma.membershipFee.create({
    data: {
      memberId: data.memberId,
      competencyYear: data.year,
      competencyMonth: data.month,
      amount: new Prisma.Decimal(data.amount),
      dueDate: parseLocalDate(data.dueDate),
      notes: data.notes || null,
      createdById: session.user.id,
    },
    include: { member: { select: { fullName: true } } },
  });

  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.CREATE, entityType: "MembershipFee", entityId: fee.id, description: `Mensalidade de ${fee.member.fullName} criada.`, newData: fee });
  revalidatePath("/admin/mensalidades");
  redirect(`/admin/mensalidades/${fee.id}?created=1`);
}

export async function registerFeePayment(id: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.FEES_PAY);
  const parsed = paymentSchema.safeParse({ paymentMethodId: formData.get("paymentMethodId"), paidAt: formData.get("paidAt"), notes: formData.get("notes") });
  if (!parsed.success) redirect(`/admin/mensalidades/${id}?error=pagamento-invalido`);

  const previous = await prisma.membershipFee.findUnique({ where: { id }, include: { member: true } });
  if (!previous) redirect("/admin/mensalidades?error=nao-encontrada");
  if (previous.status === FeeStatus.PAID) redirect(`/admin/mensalidades/${id}?error=ja-paga`);
  if (previous.status === FeeStatus.CANCELED) redirect(`/admin/mensalidades/${id}?error=cancelada`);

  const category = await prisma.cashCategory.findUnique({ where: { name: "Mensalidades" } });
  if (!category) redirect(`/admin/mensalidades/${id}?error=categoria-caixa-ausente`);
  const paidAt = parseLocalDate(parsed.data.paidAt) ?? new Date();

  const committed = await withSerializableRetry(async (tx) => {
    const fresh = await tx.membershipFee.findUnique({ where: { id }, select: { status: true } });
    if (!fresh || fresh.status === FeeStatus.PAID || fresh.status === FeeStatus.CANCELED) return false;
    await tx.membershipFee.update({
      where: { id },
      data: { status: FeeStatus.PAID, paidAt, paymentMethodId: parsed.data.paymentMethodId, notes: parsed.data.notes || previous.notes },
    });
    await tx.cashTransaction.create({
      data: {
        sourceKey: `fee-payment:${id}`,
        categoryId: category.id,
        paymentMethodId: parsed.data.paymentMethodId,
        membershipFeeId: id,
        createdById: session.user.id,
        type: CashTransactionType.INCOME,
        amount: previous.amount,
        description: `Mensalidade ${previous.competencyMonth}/${previous.competencyYear} - ${previous.member.fullName}`,
        occurredAt: paidAt,
      },
    });
    return true;
  });
  if (!committed) redirect(`/admin/mensalidades/${id}?error=ja-processada`);

  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.PAYMENT, entityType: "MembershipFee", entityId: id, description: `Mensalidade de ${previous.member.fullName} marcada como paga.`, oldData: previous, newData: { status: "PAID", paidAt, paymentMethodId: parsed.data.paymentMethodId } });
  revalidatePath("/admin/mensalidades"); revalidatePath(`/admin/mensalidades/${id}`); revalidatePath("/admin/financeiro");
  redirect(`/admin/mensalidades/${id}?paid=1`);
}

export async function exemptFee(id: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.FEES_EXEMPT);
  const parsed = exemptionSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) redirect(`/admin/mensalidades/${id}?error=isencao-invalida`);
  const previous = await prisma.membershipFee.findUnique({ where: { id }, include: { member: true } });
  if (!previous) redirect("/admin/mensalidades?error=nao-encontrada");
  if (previous.status === FeeStatus.PAID) redirect(`/admin/mensalidades/${id}?error=ja-paga`);

  const updated = await prisma.membershipFee.update({ where: { id }, data: { status: FeeStatus.EXEMPT, notes: parsed.data.reason, paidAt: null, paymentMethodId: null } });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.UPDATE, entityType: "MembershipFee", entityId: id, description: `Mensalidade de ${previous.member.fullName} isentada.`, oldData: previous, newData: updated });
  revalidatePath("/admin/mensalidades"); revalidatePath(`/admin/mensalidades/${id}`);
  redirect(`/admin/mensalidades/${id}?exempt=1`);
}

export async function cancelFee(id: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.FEES_CANCEL);
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) redirect(`/admin/mensalidades/${id}?error=motivo-invalido`);

  const previous = await prisma.membershipFee.findUnique({ where: { id }, include: { member: true, cashTransactions: { where: { type: CashTransactionType.INCOME } } } });
  if (!previous) redirect("/admin/mensalidades?error=nao-encontrada");
  if (previous.status === FeeStatus.CANCELED) redirect(`/admin/mensalidades/${id}?error=ja-cancelada`);

  await prisma.$transaction(async (tx) => {
    await tx.membershipFee.update({ where: { id }, data: { status: FeeStatus.CANCELED, notes: reason } });
    for (const cash of previous.cashTransactions) {
      const reversal = await tx.cashTransaction.findFirst({ where: { reversalOfId: cash.id } });
      if (!reversal) {
        await tx.cashTransaction.create({
          data: {
            cashRegisterId: cash.cashRegisterId, categoryId: cash.categoryId, paymentMethodId: cash.paymentMethodId,
            membershipFeeId: id, createdById: session.user.id, type: CashTransactionType.REVERSAL,
            amount: cash.amount, description: `Estorno: ${cash.description}`, occurredAt: new Date(), reversalOfId: cash.id,
            metadata: safeJson({ reason }),
          },
        });
      }
    }
  });

  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.CANCEL, entityType: "MembershipFee", entityId: id, description: `Mensalidade de ${previous.member.fullName} cancelada.`, oldData: previous, newData: { status: "CANCELED", reason } });
  revalidatePath("/admin/mensalidades"); revalidatePath(`/admin/mensalidades/${id}`); revalidatePath("/admin/financeiro");
  redirect(`/admin/mensalidades/${id}?canceled=1`);
}
