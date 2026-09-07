import { z } from "zod";

const money = z.coerce.number().positive("Informe um valor maior que zero.").max(999999.99);

export const generateFeesSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  amount: money,
  dueDay: z.coerce.number().int().min(1).max(28),
});

export const manualFeeSchema = z.object({
  memberId: z.string().min(1, "Selecione um membro."),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  amount: money,
  dueDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const paymentSchema = z.object({
  paymentMethodId: z.string().min(1, "Selecione a forma de pagamento."),
  paidAt: z.string().min(1, "Informe a data do pagamento."),
  notes: z.string().max(1000).optional(),
});

export const exemptionSchema = z.object({
  reason: z.string().min(3, "Informe o motivo da isenção.").max(1000),
});

export const defaultFeeSettingsSchema = z.object({
  amount: money,
  dueDay: z.coerce.number().int().min(1).max(28),
});

export function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
}
