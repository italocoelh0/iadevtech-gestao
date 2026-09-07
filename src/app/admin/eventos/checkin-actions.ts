"use server";

import { AuditAction, CheckinStatus, RegistrationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/log";

function activeKey(eventId: string, participantId: string) {
  return `${eventId}:${participantId}`;
}

export async function checkInParticipant(participantId: string) {
  const session = await requirePermission(PERMISSIONS.EVENTS_CHECKIN);
  const participant = await prisma.eventParticipant.findUnique({
    where: { id: participantId },
    include: { registration: { include: { event: true } } },
  });
  if (!participant) throw new Error("PARTICIPANT_NOT_FOUND");
  if ([RegistrationStatus.CANCELED, RegistrationStatus.WAITLIST].includes(participant.registration.status)) throw new Error("REGISTRATION_NOT_ELIGIBLE");
  if (!["IN_PROGRESS", "REGISTRATIONS_CLOSED", "REGISTRATIONS_OPEN"].includes(participant.registration.event.status)) throw new Error("EVENT_NOT_OPEN_FOR_CHECKIN");

  const key = activeKey(participant.registration.eventId, participant.id);
  const existing = await prisma.eventCheckin.findUnique({ where: { activeKey: key } });
  if (existing) return;

  const checkin = await prisma.eventCheckin.create({
    data: {
      eventId: participant.registration.eventId,
      participantId: participant.id,
      activeKey: key,
      checkedInById: session.user.id,
      status: CheckinStatus.CHECKED_IN,
    },
  });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.CHECKIN, entityType: "EventParticipant", entityId: participant.id, description: `Check-in realizado no evento ${participant.registration.event.name}.`, newData: { checkinId: checkin.id, status: CheckinStatus.CHECKED_IN } });
  revalidatePath(`/admin/eventos/${participant.registration.eventId}/operacao`);
  revalidatePath(`/admin/checkin/${participant.publicToken}`);
}

export async function reverseCheckIn(participantId: string) {
  const session = await requirePermission(PERMISSIONS.EVENTS_CHECKIN);
  const participant = await prisma.eventParticipant.findUnique({ where: { id: participantId }, include: { registration: { include: { event: true } } } });
  if (!participant) throw new Error("PARTICIPANT_NOT_FOUND");
  const key = activeKey(participant.registration.eventId, participant.id);
  const checkin = await prisma.eventCheckin.findUnique({ where: { activeKey: key } });
  if (!checkin) throw new Error("ACTIVE_CHECKIN_NOT_FOUND");
  await prisma.eventCheckin.update({ where: { id: checkin.id }, data: { status: CheckinStatus.REVERSED, activeKey: null, reversedAt: new Date(), reversedById: session.user.id } });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.UPDATE, entityType: "EventCheckin", entityId: checkin.id, description: `Check-in de ${participant.name} revertido.`, oldData: { status: CheckinStatus.CHECKED_IN }, newData: { status: CheckinStatus.REVERSED } });
  revalidatePath(`/admin/eventos/${participant.registration.eventId}/operacao`);
  revalidatePath(`/admin/checkin/${participant.publicToken}`);
}
