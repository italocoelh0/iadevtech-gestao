import "server-only";
import { logger } from "@/lib/server/logger";

export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export function publicError(error: unknown, fallback = "Não foi possível concluir a operação.") {
  if (error instanceof AppError) return error.message;
  logger.error("Unhandled application error", {
    error: error instanceof Error ? error.message : String(error),
  });
  return fallback;
}
