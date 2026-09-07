"use server";

import { OrderStatus, Prisma, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { publicAddOrderItemSchema } from "@/lib/orders/schema";
import { productStock } from "@/lib/stock/utils";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/server/logger";
import { requestContext } from "@/lib/security/request";

export type PublicOrderActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

async function recalcOrder(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.orderItem.findMany({
    where: { orderId, status: "ACTIVE" },
    select: { totalPrice: true },
  });
  const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { discountAmount: true },
  });
  const total = Math.max(0, subtotal - Number(order.discountAmount));
  return tx.order.update({
    where: { id: orderId },
    data: { subtotal, totalAmount: total },
  });
}

export async function addPublicOrderItem(
  _: PublicOrderActionState,
  formData: FormData,
): Promise<PublicOrderActionState> {
  const rate = await enforceRateLimit("public-order-consumption", { limit: 30, windowSeconds: 60 });
  if (!rate.allowed) {
    return { error: `Muitas operações em sequência. Tente novamente em ${rate.retryAfterSeconds} segundos.` };
  }

  const parsed = publicAddOrderItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const { token, productId, quantity } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { publicToken: token } });
      if (!order || order.status !== OrderStatus.OPEN) throw new Error("ORDER_NOT_OPEN");

      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || !product.active) throw new Error("PRODUCT_UNAVAILABLE");

      const balance = await productStock(tx, productId);
      if (quantity > balance) throw new Error("INSUFFICIENT_STOCK");

      const total = Number(product.salePrice) * quantity;
      const item = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId,
          productName: product.name,
          quantity,
          unitPrice: product.salePrice,
          totalPrice: total,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          eventId: order.eventId,
          orderItemId: item.id,
          type: StockMovementType.ORDER_CONSUMPTION,
          quantity,
          referenceType: "PUBLIC_ORDER_ITEM",
          referenceId: item.id,
          createdById: null,
          notes: `Consumo lançado pelo cliente na comanda ${order.id}.`,
        },
      });

      await recalcOrder(tx, order.id);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INSUFFICIENT_STOCK") return { error: "Estoque insuficiente para este consumo." };
    if (message === "ORDER_NOT_OPEN") return { error: "Esta comanda não está aberta para novos consumos." };
    if (message === "PRODUCT_UNAVAILABLE") return { error: "Produto indisponível." };

    const ctx = await requestContext();
    logger.error("Public order item creation failed", {
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  revalidatePath(`/comanda/${token}`);
  revalidatePath("/admin/comandas");
  return { success: "Consumo adicionado à comanda." };
}

export async function closePublicOrder(token: string): Promise<void> {
  const rate = await enforceRateLimit("public-order-close", { limit: 10, windowSeconds: 300 });
  if (!rate.allowed) throw new Error("RATE_LIMITED");

  const order = await prisma.order.findUnique({
    where: { publicToken: token },
    include: { items: { where: { status: "ACTIVE" }, select: { id: true } } },
  });

  if (!order || order.status !== OrderStatus.OPEN) throw new Error("ORDER_NOT_OPEN");
  if (!order.items.length) throw new Error("ORDER_EMPTY");

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({ where: { id: order.id }, select: { status: true } });
    if (!fresh || fresh.status !== OrderStatus.OPEN) throw new Error("ORDER_NOT_OPEN");
    const recalculated = await recalcOrder(tx, order.id);
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.AWAITING_PAYMENT,
        closedAt: new Date(),
        subtotal: recalculated.subtotal,
        totalAmount: recalculated.totalAmount,
      },
    });
  });

  revalidatePath(`/comanda/${token}`);
  revalidatePath(`/admin/comandas/${order.id}`);
  revalidatePath("/admin/comandas");
}
