import { Prisma, StockMovementType } from "@prisma/client";

export const STOCK_IN_TYPES: StockMovementType[] = [
  "PURCHASE", "DONATION", "RETURN", "ADJUSTMENT_IN", "EVENT_RETURN",
];
export const STOCK_OUT_TYPES: StockMovementType[] = [
  "ORDER_CONSUMPTION", "LOSS", "DAMAGE", "INTERNAL_USE", "ADJUSTMENT_OUT", "EVENT_TRANSFER",
];

export function movementFactor(type: StockMovementType) {
  return STOCK_IN_TYPES.includes(type) ? 1 : -1;
}

export function signedQuantity(type: StockMovementType, quantity: Prisma.Decimal | number | string) {
  return movementFactor(type) * Number(quantity);
}

export async function productStock(tx: Prisma.TransactionClient, productId: string) {
  const movements = await tx.stockMovement.groupBy({
    by: ["type"],
    where: { productId },
    _sum: { quantity: true },
  });
  return movements.reduce((sum, movement) => sum + signedQuantity(movement.type, movement._sum.quantity ?? 0), 0);
}

export function movementLabel(type: StockMovementType) {
  const labels: Record<StockMovementType, string> = {
    PURCHASE: "Compra", DONATION: "Doação", RETURN: "Devolução", ORDER_CONSUMPTION: "Consumo em comanda",
    LOSS: "Perda", DAMAGE: "Avaria", INTERNAL_USE: "Uso interno", ADJUSTMENT_IN: "Ajuste de entrada",
    ADJUSTMENT_OUT: "Ajuste de saída", EVENT_TRANSFER: "Envio para evento", EVENT_RETURN: "Retorno de evento",
  };
  return labels[type];
}

export function formatQuantity(value: number | string, unit?: string) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(value))}${unit ? ` ${unit}` : ""}`;
}
