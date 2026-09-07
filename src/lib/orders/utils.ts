import { OrderStatus } from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN: "Aberta",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAYMENT_PROCESSING: "Pagamento em análise",
  PAID: "Paga",
  CANCELED: "Cancelada",
};

export function formatOrderMoney(value: number | string | { toString(): string }) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}
