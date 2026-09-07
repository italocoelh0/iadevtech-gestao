import "server-only";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestContext } from "@/lib/security/request";

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAuditLog(input: {
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  description?: string;
  oldData?: unknown;
  newData?: unknown;
}) {
  let ipAddress: string | undefined;
  let userAgent: string | undefined;
  try {
    const context = await requestContext();
    ipAddress = context.ip === "unknown" ? undefined : context.ip;
    userAgent = context.userAgent;
  } catch {
    // Mantém auditoria funcional também em contextos sem request HTTP.
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description,
      oldData: toJson(input.oldData),
      newData: toJson(input.newData),
      ipAddress,
      userAgent,
    },
  });
}
