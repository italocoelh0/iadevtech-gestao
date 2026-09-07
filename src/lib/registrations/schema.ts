import { z } from "zod";

const participantSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do participante."),
  registrationTypeId: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
});

export const publicRegistrationSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do responsável."),
  phone: z.string().trim().min(8, "Informe um telefone válido."),
  email: z.union([z.literal(""), z.string().trim().email("Informe um e-mail válido.")]).optional(),
  notes: z.string().trim().max(2000).optional(),
  participants: z.array(participantSchema).min(1).max(10),
  benefitRuleId: z.string().trim().optional(),
  benefitReason: z.string().trim().max(1000).optional(),
});

export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;
