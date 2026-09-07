"use server";

import { PaymentStatus, PaymentMethodType, RegistrationStatus } from "@prisma/client";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicRegistrationSchema } from "@/lib/registrations/schema";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { withSerializableRetry } from "@/lib/server/transaction";
import { logger } from "@/lib/server/logger";
import { requestContext } from "@/lib/security/request";

export type PublicRegistrationState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

function parseParticipants(formData: FormData) {
  const count = Math.min(10, Math.max(1, Number(formData.get("participantCount") ?? 1)));
  return Array.from({ length: count }, (_, index) => ({
    name: String(formData.get(`participant.${index}.name`) ?? ""),
    registrationTypeId: String(formData.get(`participant.${index}.registrationTypeId`) ?? ""),
    birthDate: String(formData.get(`participant.${index}.birthDate`) ?? ""),
  }));
}

export async function createPublicRegistration(eventId: string, slug: string, _: PublicRegistrationState, formData: FormData): Promise<PublicRegistrationState> {
  if (String(formData.get("website") ?? "").trim()) return { error: "Não foi possível concluir a inscrição." };

  const rate = await enforceRateLimit(`public-registration:${eventId}`, { limit: 8, windowSeconds: 600 });
  if (!rate.allowed) return { error: `Muitas tentativas. Tente novamente em cerca de ${rate.retryAfterSeconds} segundos.` };

  const parsed = publicRegistrationSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    participants: parseParticipants(formData),
    benefitRuleId: String(formData.get("benefitRuleId") ?? ""),
    benefitReason: String(formData.get("benefitReason") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, error: "Revise os dados informados." };

  const event = await prisma.event.findFirst({
    where: { id: eventId, slug, isPublic: true },
    include: { registrationTypes: { where: { active: true } }, exemptionRules: { where: { active: true } } },
  });
  if (!event) return { error: "Evento não encontrado." };

  const now = new Date();
  const inWindow = (!event.registrationOpensAt || now >= event.registrationOpensAt) && (!event.registrationClosesAt || now <= event.registrationClosesAt);
  if (event.status !== "REGISTRATIONS_OPEN" || !inWindow) return { error: "As inscrições não estão abertas neste momento." };
  if (!event.allowGroupRegistration && parsed.data.participants.length > 1) return { error: "Este evento não permite inscrição em grupo." };

  const typeMap = new Map(event.registrationTypes.map((t) => [t.id, t]));
  if (parsed.data.participants.some((participant) => participant.registrationTypeId && !typeMap.has(participant.registrationTypeId))) {
    return { error: "Um dos tipos de inscrição selecionados não está mais disponível." };
  }

  const participantData = parsed.data.participants.map((participant) => {
    const type = participant.registrationTypeId ? typeMap.get(participant.registrationTypeId) : undefined;
    const amount = Number(type?.price ?? event.defaultPrice);
    return { ...participant, amount };
  });
  const subtotal = participantData.reduce((sum, p) => sum + p.amount, 0);
  const responsibleMember = await prisma.member.findFirst({
    where: { status: "ACTIVE", OR: [{ phone: parsed.data.phone }, ...(parsed.data.email ? [{ email: parsed.data.email }] : [])] },
    select: { id: true },
  });
  const requestedRule = parsed.data.benefitRuleId ? event.exemptionRules.find((r) => r.id === parsed.data.benefitRuleId) : undefined;

  const registration = await withSerializableRetry(async (tx) => {
    const freshEvent = await tx.event.findUnique({ where: { id: eventId }, select: { capacity: true, status: true, registrationOpensAt: true, registrationClosesAt: true } });
    if (!freshEvent || freshEvent.status !== "REGISTRATIONS_OPEN") throw new Error("REGISTRATION_CLOSED");

    const transactionNow = new Date();
    const transactionWindow = (!freshEvent.registrationOpensAt || transactionNow >= freshEvent.registrationOpensAt) && (!freshEvent.registrationClosesAt || transactionNow <= freshEvent.registrationClosesAt);
    if (!transactionWindow) throw new Error("REGISTRATION_CLOSED");

    const activeParticipants = await tx.eventParticipant.count({
      where: { registration: { eventId, status: { notIn: [RegistrationStatus.CANCELED, RegistrationStatus.WAITLIST] } } },
    });
    const wouldExceed = freshEvent.capacity != null && activeParticipants + participantData.length > freshEvent.capacity;

    const created = await tx.eventRegistration.create({
      data: {
        eventId,
        responsibleMemberId: responsibleMember?.id,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
        participantCount: participantData.length,
        subtotal,
        discountAmount: 0,
        finalAmount: subtotal,
        status: wouldExceed ? RegistrationStatus.WAITLIST : subtotal > 0 ? RegistrationStatus.AWAITING_PAYMENT : RegistrationStatus.CONFIRMED,
        publicToken: randomBytes(32).toString("base64url"),
        participants: {
          create: participantData.map((p) => ({
            name: p.name,
            registrationTypeId: p.registrationTypeId || null,
            birthDate: p.birthDate ? new Date(`${p.birthDate}T12:00:00`) : null,
            amount: p.amount,
            discountAmount: 0,
            finalAmount: p.amount,
            publicToken: randomBytes(32).toString("base64url"),
          })),
        },
      },
    });

    if (!wouldExceed && subtotal > 0) {
      const pix = await tx.paymentMethod.findFirst({ where: { type: PaymentMethodType.PIX, active: true } });
      if (pix) await tx.eventPayment.create({ data: { registrationId: created.id, paymentMethodId: pix.id, amount: subtotal, status: PaymentStatus.PENDING } });
    }

    if (requestedRule) {
      await tx.eventBenefitApproval.create({
        data: {
          eventId,
          registrationId: created.id,
          ruleId: requestedRule.id,
          requestedByName: parsed.data.name,
          reason: parsed.data.benefitReason || null,
          benefitType: requestedRule.benefitType,
          benefitValue: requestedRule.benefitValue,
        },
      });
    }
    return created;
  }).catch(async (error) => {
    if (error instanceof Error && error.message === "REGISTRATION_CLOSED") return null;
    const ctx = await requestContext();
    logger.error("Public registration failed", { requestId: ctx.requestId, eventId, error: error instanceof Error ? error.message : String(error) });
    throw error;
  });

  if (!registration) return { error: "As inscrições foram encerradas antes da confirmação. Atualize a página e tente novamente." };
  redirect(`/eventos/${slug}/inscricao/${registration.publicToken}`);
}
