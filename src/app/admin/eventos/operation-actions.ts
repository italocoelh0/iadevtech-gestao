"use server";

import { AuditAction, EventStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { getEventOperation } from "@/lib/events/operation";

export async function finishEventOperationally(eventId: string) {
  const session = await requirePermission(PERMISSIONS.EVENTS_FINISH);
  const operation = await getEventOperation(eventId);
  if (!operation) throw new Error("EVENT_NOT_FOUND");
  if (operation.event.status !== EventStatus.IN_PROGRESS) throw new Error("EVENT_NOT_IN_PROGRESS");
  if (operation.blockers.length) throw new Error(`EVENT_HAS_PENDING_ITEMS:${operation.blockers.join("; ")}`);
  await prisma.event.update({ where: { id: eventId }, data: { status: EventStatus.FINISHED } });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.UPDATE, entityType: "Event", entityId: eventId, description: "Evento finalizado pelo painel operacional após validação das pendências.", oldData: { status: EventStatus.IN_PROGRESS }, newData: { status: EventStatus.FINISHED } });
  revalidatePath(`/admin/eventos/${eventId}`);
  revalidatePath(`/admin/eventos/${eventId}/operacao`);
  revalidatePath("/admin/eventos");
}
