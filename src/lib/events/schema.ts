import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url("Informe uma URL válida.").optional());
const optionalDateTime = z.preprocess(emptyToUndefined, z.string().optional());
const optionalInt = z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional());

export const eventSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do evento."),
  slug: z.string().trim().min(3, "Informe o slug.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
  description: optionalString,
  coverImageUrl: optionalUrl,
  startsAt: z.string().min(1, "Informe a data e hora de início."),
  endsAt: optionalDateTime,
  location: optionalString,
  address: optionalString,
  city: optionalString,
  state: z.preprocess(emptyToUndefined, z.string().trim().max(2, "Use a sigla do estado.").optional()),
  registrationOpensAt: optionalDateTime,
  registrationClosesAt: optionalDateTime,
  capacity: optionalInt,
  defaultPrice: z.coerce.number().min(0, "O valor não pode ser negativo."),
  isPublic: z.boolean(),
  allowMembers: z.boolean(),
  allowNonMembers: z.boolean(),
  allowCompanions: z.boolean(),
  allowGroupRegistration: z.boolean(),
  notes: optionalString,
}).superRefine((data, ctx) => {
  const start = new Date(data.startsAt);
  const end = data.endsAt ? new Date(data.endsAt) : null;
  const open = data.registrationOpensAt ? new Date(data.registrationOpensAt) : null;
  const close = data.registrationClosesAt ? new Date(data.registrationClosesAt) : null;

  if (Number.isNaN(start.getTime())) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Data de início inválida." });
  if (end && end < start) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O fim não pode ser anterior ao início." });
  if (open && close && close < open) ctx.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "O encerramento das inscrições deve ser posterior à abertura." });
});

export const registrationTypeSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do tipo."),
  description: optionalString,
  price: z.coerce.number().min(0, "O valor não pode ser negativo."),
  minAge: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  maxAge: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
});

export const benefitRuleSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da regra."),
  description: optionalString,
  benefitType: z.enum(["EXEMPTION", "PERCENTAGE_DISCOUNT", "FIXED_DISCOUNT", "SPECIAL_PRICE"]),
  benefitValue: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
});

export function toDateTime(value?: string) {
  return value ? new Date(value) : null;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
