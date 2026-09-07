import { BloodType, MemberStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z.string().trim().transform((value) => value || undefined).optional();
const optionalEmail = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .pipe(z.string().email("Informe um e-mail válido.").optional());

export const memberSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo."),
  phone: optionalText,
  email: optionalEmail,
  bloodType: z.nativeEnum(BloodType),
  birthDate: z.string().optional(),
  address: optionalText,
  city: optionalText,
  state: z.string().trim().max(2, "Use a sigla do estado.").transform((v) => v.toUpperCase()).optional(),
  joinedAt: z.string().optional(),
  status: z.nativeEnum(MemberStatus),
  notes: optionalText,
});

export type MemberFormValues = z.infer<typeof memberSchema>;

export function parseOptionalDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
