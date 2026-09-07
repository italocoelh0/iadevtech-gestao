"use server";

import { AuditAction, CashRegisterStatus, CashTransactionType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { categorySchema, closeCashSchema, openCashSchema, parseLocalDateTime, paymentMethodSchema, transactionSchema } from "@/lib/finance/schema";

export async function createTransaction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.FINANCE_CREATE);
  const parsed = transactionSchema.safeParse({
    type: formData.get("type"), categoryId: formData.get("categoryId"), paymentMethodId: formData.get("paymentMethodId") || undefined,
    eventId: formData.get("eventId") || undefined, amount: formData.get("amount"), description: formData.get("description"),
    occurredAt: formData.get("occurredAt"), attachmentUrl: formData.get("attachmentUrl") || undefined,
  });
  if (!parsed.success) redirect("/admin/financeiro/novo?error=dados-invalidos");

  const category = await prisma.cashCategory.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category || !category.active || category.type !== parsed.data.type) redirect("/admin/financeiro/novo?error=categoria-invalida");

  const openCash = await prisma.cashRegister.findFirst({ where: { status: CashRegisterStatus.OPEN }, orderBy: { openedAt: "desc" } });
  const tx = await prisma.cashTransaction.create({
    data: {
      cashRegisterId: openCash?.id,
      categoryId: parsed.data.categoryId,
      paymentMethodId: parsed.data.paymentMethodId || null,
      eventId: parsed.data.eventId || null,
      createdById: session.user.id,
      type: parsed.data.type,
      amount: new Prisma.Decimal(parsed.data.amount),
      description: parsed.data.description,
      occurredAt: parseLocalDateTime(parsed.data.occurredAt),
      attachmentUrl: parsed.data.attachmentUrl || null,
    },
  });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.CREATE, entityType: "CashTransaction", entityId: tx.id, description: `Movimentação financeira ${parsed.data.type === "INCOME" ? "de receita" : "de despesa"} criada.`, newData: tx });
  revalidatePath("/admin/financeiro");
  redirect(`/admin/financeiro/${tx.id}?created=1`);
}

export async function reverseTransaction(id: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.FINANCE_REVERSE);
  const reason = String(formData.get("reason") || "").trim();
  if (reason.length < 3) redirect(`/admin/financeiro/${id}?error=motivo-obrigatorio`);

  const previous = await prisma.cashTransaction.findUnique({ where: { id }, include: { category: true } });
  if (!previous) redirect("/admin/financeiro?error=nao-encontrada");
  if (previous.reversedAt || previous.type === CashTransactionType.REVERSAL) redirect(`/admin/financeiro/${id}?error=ja-estornada`);

  const reversalCategory = await prisma.cashCategory.findFirst({ where: { type: previous.type === CashTransactionType.INCOME ? "EXPENSE" : "INCOME", active: true }, orderBy: { name: "asc" } });
  if (!reversalCategory) redirect(`/admin/financeiro/${id}?error=categoria-estorno-ausente`);

  const now = new Date();
  const reversal = await prisma.$transaction(async (db) => {
    await db.cashTransaction.update({ where: { id }, data: { reversedAt: now } });
    return db.cashTransaction.create({ data: {
      cashRegisterId: previous.cashRegisterId,
      categoryId: reversalCategory.id,
      paymentMethodId: previous.paymentMethodId,
      eventId: previous.eventId,
      registrationId: previous.registrationId,
      membershipFeeId: previous.membershipFeeId,
      orderId: previous.orderId,
      createdById: session.user.id,
      type: CashTransactionType.REVERSAL,
      amount: previous.amount,
      description: `Estorno: ${previous.description} — ${reason}`,
      occurredAt: now,
      reversalOfId: previous.id,
      metadata: { originalType: previous.type, reason },
    }});
  });

  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.REFUND, entityType: "CashTransaction", entityId: id, description: `Movimentação financeira estornada: ${reason}`, oldData: previous, newData: reversal });
  revalidatePath("/admin/financeiro"); revalidatePath(`/admin/financeiro/${id}`);
  redirect(`/admin/financeiro/${id}?reversed=1`);
}

export async function openCashRegister(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CASH_OPEN);
  const parsed = openCashSchema.safeParse({ openingBalance: formData.get("openingBalance"), notes: formData.get("notes") });
  if (!parsed.success) redirect("/admin/financeiro/caixa?error=dados-invalidos");
  const existing = await prisma.cashRegister.findFirst({ where: { status: CashRegisterStatus.OPEN } });
  if (existing) redirect(`/admin/financeiro/caixa?error=caixa-ja-aberto&id=${existing.id}`);
  const cash = await prisma.cashRegister.create({ data: { openedById: session.user.id, openedAt: new Date(), openingBalance: new Prisma.Decimal(parsed.data.openingBalance), status: CashRegisterStatus.OPEN, notes: parsed.data.notes || null } });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.CASH_OPEN, entityType: "CashRegister", entityId: cash.id, description: "Caixa aberto.", newData: cash });
  revalidatePath("/admin/financeiro"); revalidatePath("/admin/financeiro/caixa");
  redirect("/admin/financeiro/caixa?opened=1");
}

export async function closeCashRegister(id: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CASH_CLOSE);
  const parsed = closeCashSchema.safeParse({ closingBalance: formData.get("closingBalance"), notes: formData.get("notes") });
  if (!parsed.success) redirect("/admin/financeiro/caixa?error=dados-invalidos");
  const cash = await prisma.cashRegister.findUnique({ where: { id }, include: { transactions: { where: { reversedAt: null } } } });
  if (!cash || cash.status !== CashRegisterStatus.OPEN) redirect("/admin/financeiro/caixa?error=caixa-nao-aberto");
  let expected = Number(cash.openingBalance);
  for (const item of cash.transactions) {
    if (item.type === CashTransactionType.INCOME) expected += Number(item.amount);
    else if (item.type === CashTransactionType.EXPENSE) expected -= Number(item.amount);
    else if (item.type === CashTransactionType.REVERSAL) {
      const meta = item.metadata as { originalType?: string } | null;
      expected += meta?.originalType === "EXPENSE" ? Number(item.amount) : -Number(item.amount);
    }
  }
  const counted = parsed.data.closingBalance;
  const closed = await prisma.cashRegister.update({ where: { id }, data: { status: CashRegisterStatus.CLOSED, closedAt: new Date(), closedById: session.user.id, expectedBalance: new Prisma.Decimal(expected), closingBalance: new Prisma.Decimal(counted), difference: new Prisma.Decimal(counted - expected), notes: parsed.data.notes ? `${cash.notes ? cash.notes + "\n" : ""}${parsed.data.notes}` : cash.notes } });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.CASH_CLOSE, entityType: "CashRegister", entityId: id, description: "Caixa fechado.", oldData: cash, newData: closed });
  revalidatePath("/admin/financeiro"); revalidatePath("/admin/financeiro/caixa");
  redirect("/admin/financeiro/caixa?closed=1");
}

export async function createCashCategory(formData: FormData) {
  await requirePermission(PERMISSIONS.FINANCE_SETTINGS);
  const parsed = categorySchema.safeParse({ name: formData.get("name"), type: formData.get("type"), description: formData.get("description") });
  if (!parsed.success) redirect("/admin/financeiro/configuracoes?error=categoria-invalida");
  await prisma.cashCategory.upsert({ where: { name: parsed.data.name }, update: { type: parsed.data.type, description: parsed.data.description || null, active: true }, create: { name: parsed.data.name, type: parsed.data.type, description: parsed.data.description || null } });
  revalidatePath("/admin/financeiro/configuracoes"); redirect("/admin/financeiro/configuracoes?category=1");
}

export async function toggleCashCategory(id: string) {
  await requirePermission(PERMISSIONS.FINANCE_SETTINGS);
  const category = await prisma.cashCategory.findUnique({ where: { id } });
  if (!category) redirect("/admin/financeiro/configuracoes?error=categoria-nao-encontrada");
  await prisma.cashCategory.update({ where: { id }, data: { active: !category.active } });
  revalidatePath("/admin/financeiro/configuracoes");
}

export async function createPaymentMethod(formData: FormData) {
  await requirePermission(PERMISSIONS.FINANCE_SETTINGS);
  const parsed = paymentMethodSchema.safeParse({ name: formData.get("name"), type: formData.get("type") });
  if (!parsed.success) redirect("/admin/financeiro/configuracoes?error=forma-invalida");
  await prisma.paymentMethod.upsert({ where: { name: parsed.data.name }, update: { type: parsed.data.type, active: true }, create: { name: parsed.data.name, type: parsed.data.type } });
  revalidatePath("/admin/financeiro/configuracoes"); redirect("/admin/financeiro/configuracoes?method=1");
}

export async function togglePaymentMethod(id: string) {
  await requirePermission(PERMISSIONS.FINANCE_SETTINGS);
  const method = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!method) redirect("/admin/financeiro/configuracoes?error=forma-nao-encontrada");
  await prisma.paymentMethod.update({ where: { id }, data: { active: !method.active } });
  revalidatePath("/admin/financeiro/configuracoes");
}
