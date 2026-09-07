import { CashTransactionType } from "@prisma/client";

export function formatMoney(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export function signedAmount(type: CashTransactionType, amount: string | number) {
  const value = Number(amount);
  if (type === "INCOME") return value;
  if (type === "EXPENSE") return -value;
  if (type === "REVERSAL") return value;
  return value;
}
