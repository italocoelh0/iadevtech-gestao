import { CashTransactionType, Prisma } from "@prisma/client";

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function parseDateRange(from?: string, to?: string) {
  const now = new Date();
  const start = from ? new Date(`${from}T00:00:00`) : startOfMonth(now);
  const end = to ? new Date(`${to}T23:59:59.999`) : endOfMonth(now);
  return { start, end };
}

export function money(value: Prisma.Decimal | number | string | null | undefined) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
}

export function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function signedCashAmount(type: CashTransactionType, amount: Prisma.Decimal | number | string) {
  const value = Number(amount);
  if (type === "INCOME") return value;
  if (type === "EXPENSE") return -value;
  return 0;
}

export const stockInTypes = ["PURCHASE", "DONATION", "RETURN", "ADJUSTMENT_IN", "EVENT_RETURN"] as const;
export const stockOutTypes = ["ORDER_CONSUMPTION", "LOSS", "DAMAGE", "INTERNAL_USE", "ADJUSTMENT_OUT", "EVENT_TRANSFER"] as const;
