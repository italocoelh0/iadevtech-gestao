import { z } from "zod";

export const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().min(1),
  paymentMethodId: z.string().optional(),
  eventId: z.string().optional(),
  amount: z.coerce.number().positive("Informe um valor maior que zero."),
  description: z.string().trim().min(3).max(240),
  occurredAt: z.string().min(1),
  attachmentUrl: z.string().trim().url().optional().or(z.literal("")),
});

export const openCashSchema = z.object({
  openingBalance: z.coerce.number().min(0),
  notes: z.string().trim().max(1000).optional(),
});

export const closeCashSchema = z.object({
  closingBalance: z.coerce.number().min(0),
  notes: z.string().trim().max(1000).optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().trim().max(240).optional(),
});

export const paymentMethodSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "BANK_TRANSFER", "OTHER"]),
});

export function parseLocalDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
