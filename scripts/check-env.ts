import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().startsWith("mysql://", "DATABASE_URL deve usar mysql://"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET deve ter pelo menos 32 caracteres"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  ADMIN_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  if (!parsed.data.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
    console.error("Em produção, NEXT_PUBLIC_APP_URL deve usar HTTPS.");
    process.exit(1);
  }
  if (parsed.data.ADMIN_PASSWORD === "CHANGE_ME") {
    console.error("ADMIN_PASSWORD não pode usar o valor de exemplo em produção.");
    process.exit(1);
  }
}

console.log("Variáveis essenciais validadas.");
