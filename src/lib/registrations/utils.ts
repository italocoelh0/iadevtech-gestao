import type { RegistrationBenefitType, RegistrationStatus } from "@prisma/client";

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  PENDING: "Pendente",
  AWAITING_PAYMENT: "Aguardando pagamento",
  CONFIRMED: "Confirmada",
  PAID: "Paga",
  EXEMPT: "Isenta",
  CANCELED: "Cancelada",
  WAITLIST: "Lista de espera",
};

export function applyBenefit(
  subtotal: number,
  type: RegistrationBenefitType,
  value?: number | null,
) {
  if (type === "EXEMPTION") return subtotal;
  if (type === "PERCENTAGE_DISCOUNT") return Math.min(subtotal, subtotal * Math.max(0, Math.min(100, value ?? 0)) / 100);
  if (type === "FIXED_DISCOUNT") return Math.min(subtotal, Math.max(0, value ?? 0));
  if (type === "SPECIAL_PRICE") return Math.max(0, subtotal - Math.max(0, value ?? 0));
  return 0;
}

export function money(value: number | string | { toString(): string }) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}
