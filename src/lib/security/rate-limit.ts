import "server-only";
import { prisma } from "@/lib/prisma";
import { hashIdentifier, requestContext } from "@/lib/security/request";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function enforceRateLimit(scope: string, options?: { limit?: number; windowSeconds?: number }): Promise<RateLimitResult> {
  const limit = options?.limit ?? 10;
  const windowSeconds = options?.windowSeconds ?? 60;
  const { ip } = await requestContext();
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);
  const key = `${scope}:${hashIdentifier(ip)}:${windowStart}`;

  const bucket = await prisma.rateLimitBucket.upsert({
    where: { key },
    create: { key, count: 1, expiresAt },
    update: { count: { increment: 1 } },
  });

  // Limpeza oportunista, sem depender de cron.
  if (Math.random() < 0.01) {
    void prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } }).catch(() => undefined);
  }

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
  };
}
