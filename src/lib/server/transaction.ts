import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function withSerializableRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, retries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error as { code?: string }).code === "P2034";
      if (!retryable || attempt === retries - 1) throw error;
    }
  }
  throw lastError;
}
