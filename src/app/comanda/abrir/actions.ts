"use server";

import { randomBytes } from "crypto";
import { OrderOrigin } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { openOrderSchema } from "@/lib/orders/schema";
import { normalizePhone } from "@/lib/orders/utils";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/server/logger";
import { withSerializableRetry } from "@/lib/server/transaction";
import { requestContext } from "@/lib/security/request";

export type PublicOrderState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

export async function openPublicOrder(_: PublicOrderState, formData: FormData): Promise<PublicOrderState> {
  if (String(formData.get("website") ?? "").trim()) return { error: "Não foi possível abrir a comanda." };

  const rate = await enforceRateLimit("public-order-open", { limit: 6, windowSeconds: 600 });
  if (!rate.allowed) return { error: `Muitas tentativas. Tente novamente em cerca de ${rate.retryAfterSeconds} segundos.` };

  const parsed = openOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  let event: { id: string } | null = null;
  if (parsed.data.eventId) {
    event = await prisma.event.findFirst({
      where: {
        id: parsed.data.eventId,
        isPublic: true,
        status: { in: ["PUBLISHED", "REGISTRATIONS_OPEN", "REGISTRATIONS_CLOSED", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (!event) return { error: "Evento indisponível para comandas." };
  }

  let order: { publicToken: string };
  const normalizedPhone = normalizePhone(parsed.data.customerPhone);
  try {
    order = await withSerializableRetry(async (tx) => {
      const existingOpenOrder = await tx.order.findFirst({
        where: { customerPhone: normalizedPhone, status: "OPEN" },
        orderBy: { openedAt: "desc" },
        select: { publicToken: true },
      });

      if (existingOpenOrder) return existingOpenOrder;

      const token = randomBytes(32).toString("base64url");
      return tx.order.create({
        data: {
          eventId: event?.id ?? null,
          origin: event ? OrderOrigin.EVENT : OrderOrigin.MANUAL,
          publicToken: token,
          customerName: parsed.data.customerName,
          customerPhone: normalizedPhone,
          subtotal: 0,
          totalAmount: 0,
        },
        select: { publicToken: true },
      });
    });
  } catch (error) {
    const ctx = await requestContext();
    logger.error("Public order creation failed", { requestId: ctx.requestId, eventId: event?.id ?? null, origin: event ? "EVENT" : "MANUAL", error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
  redirect(`/comanda/${order.publicToken}`);
}
