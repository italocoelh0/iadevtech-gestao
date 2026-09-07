"use server";

import { AuditAction, BenefitApprovalStatus, CashTransactionType, PaymentStatus, RegistrationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { applyBenefit } from "@/lib/registrations/utils";
import { withSerializableRetry } from "@/lib/server/transaction";

export async function confirmRegistrationPayment(registrationId: string) {
  const session = await requirePermission(PERMISSIONS.REGISTRATIONS_PAYMENT);
  const registration = await prisma.eventRegistration.findUnique({ where: { id: registrationId }, include: { payments: { where: { status: PaymentStatus.PENDING }, orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!registration) throw new Error("REGISTRATION_NOT_FOUND");
  if (registration.status === RegistrationStatus.PAID) return;
  if (Number(registration.finalAmount) <= 0) throw new Error("REGISTRATION_HAS_NO_AMOUNT");
  const category = await prisma.cashCategory.findUnique({ where: { name: "Eventos" } });
  const payment = registration.payments[0];
  if (!category || !payment) throw new Error("PAYMENT_CONFIGURATION_NOT_FOUND");
  const cash = await prisma.cashRegister.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } });

  const committed = await withSerializableRetry(async (tx) => {
    const fresh = await tx.eventRegistration.findUnique({ where: { id: registrationId }, select: { status: true } });
    if (!fresh || fresh.status === RegistrationStatus.PAID) return false;
    await tx.eventPayment.update({ where: { id: payment.id }, data: { status: PaymentStatus.PAID, paidAt: new Date() } });
    await tx.eventRegistration.update({ where: { id: registrationId }, data: { status: RegistrationStatus.PAID, confirmedAt: new Date() } });
    await tx.cashTransaction.create({ data: { sourceKey: `registration-payment:${registrationId}`, cashRegisterId: cash?.id, categoryId: category.id, paymentMethodId: payment.paymentMethodId, eventId: registration.eventId, registrationId, createdById: session.user.id, type: CashTransactionType.INCOME, amount: registration.finalAmount, description: `Inscrição de evento - ${registration.name}` } });
    return true;
  });
  if (!committed) return;
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.PAYMENT, entityType: "EventRegistration", entityId: registrationId, description: "Pagamento PIX manual da inscrição confirmado.", oldData: { status: registration.status }, newData: { status: RegistrationStatus.PAID, amount: registration.finalAmount.toString() } });
  revalidatePath(`/admin/inscricoes/${registrationId}`); revalidatePath('/admin/inscricoes');
}

export async function cancelRegistration(registrationId: string) {
  const session = await requirePermission(PERMISSIONS.REGISTRATIONS_UPDATE);
  const registration = await prisma.eventRegistration.findUnique({ where: { id: registrationId } });
  if (!registration) throw new Error("REGISTRATION_NOT_FOUND");
  if (registration.status === RegistrationStatus.PAID) throw new Error("PAID_REGISTRATION_REQUIRES_FINANCIAL_REVERSAL");
  await prisma.eventRegistration.update({ where: { id: registrationId }, data: { status: RegistrationStatus.CANCELED, canceledAt: new Date() } });
  await prisma.eventPayment.updateMany({ where: { registrationId, status: PaymentStatus.PENDING }, data: { status: PaymentStatus.CANCELED } });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.CANCEL, entityType: "EventRegistration", entityId: registrationId, description: "Inscrição cancelada.", oldData: { status: registration.status }, newData: { status: RegistrationStatus.CANCELED } });
  revalidatePath(`/admin/inscricoes/${registrationId}`); revalidatePath('/admin/inscricoes');
}

export async function decideBenefit(approvalId: string, approve: boolean) {
  const session = await requirePermission(PERMISSIONS.REGISTRATIONS_BENEFITS);
  const approval = await prisma.eventBenefitApproval.findUnique({ where: { id: approvalId }, include: { registration: true, rule: true } });
  if (!approval || approval.status !== BenefitApprovalStatus.PENDING) throw new Error("BENEFIT_NOT_FOUND");
  if (!approve) {
    await prisma.eventBenefitApproval.update({ where: { id: approvalId }, data: { status: BenefitApprovalStatus.REJECTED, approvedById: session.user.id, decidedAt: new Date() } });
  } else {
    const type = approval.benefitType ?? approval.rule?.benefitType ?? "EXEMPTION";
    const value = approval.benefitValue ?? approval.rule?.benefitValue;
    const subtotal = Number(approval.registration.subtotal);
    const discount = applyBenefit(subtotal, type, value ? Number(value) : null);
    const finalAmount = Math.max(0, subtotal - discount);
    await prisma.$transaction(async (tx) => {
      await tx.eventBenefitApproval.update({ where: { id: approvalId }, data: { status: BenefitApprovalStatus.APPROVED, approvedById: session.user.id, decidedAt: new Date(), benefitType: type, benefitValue: value } });
      await tx.eventRegistration.update({ where: { id: approval.registrationId }, data: { discountAmount: discount, finalAmount, status: finalAmount === 0 ? RegistrationStatus.EXEMPT : RegistrationStatus.AWAITING_PAYMENT } });
      await tx.eventPayment.updateMany({ where: { registrationId: approval.registrationId, status: PaymentStatus.PENDING }, data: { amount: finalAmount, status: finalAmount === 0 ? PaymentStatus.CANCELED : PaymentStatus.PENDING } });
    });
  }
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.UPDATE, entityType: "EventBenefitApproval", entityId: approvalId, description: approve ? "Benefício aprovado." : "Benefício rejeitado.", newData: { status: approve ? "APPROVED" : "REJECTED" } });
  revalidatePath(`/admin/inscricoes/${approval.registrationId}`); revalidatePath('/admin/inscricoes');
}

export async function moveFromWaitlist(registrationId: string) {
  const session = await requirePermission(PERMISSIONS.REGISTRATIONS_UPDATE);
  const registration = await prisma.eventRegistration.findUnique({ where: { id: registrationId }, include: { event: true } });
  if (!registration || registration.status !== RegistrationStatus.WAITLIST) throw new Error("REGISTRATION_NOT_WAITLISTED");
  const occupied = await prisma.eventParticipant.count({ where: { registration: { eventId: registration.eventId, status: { notIn: [RegistrationStatus.CANCELED, RegistrationStatus.WAITLIST] } } } });
  if (registration.event.capacity != null && occupied + registration.participantCount > registration.event.capacity) throw new Error("EVENT_CAPACITY_EXCEEDED");
  const pix = await prisma.paymentMethod.findFirst({ where: { type: "PIX", active: true } });
  await prisma.$transaction(async tx => {
    await tx.eventRegistration.update({ where: { id: registrationId }, data: { status: Number(registration.finalAmount)>0?RegistrationStatus.AWAITING_PAYMENT:RegistrationStatus.CONFIRMED } });
    if (Number(registration.finalAmount)>0 && pix) await tx.eventPayment.create({ data: { registrationId, paymentMethodId: pix.id, amount: registration.finalAmount, status: PaymentStatus.PENDING } });
  });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.UPDATE, entityType: "EventRegistration", entityId: registrationId, description: "Inscrição removida da lista de espera." });
  revalidatePath(`/admin/inscricoes/${registrationId}`); revalidatePath('/admin/inscricoes');
}
