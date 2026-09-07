import "server-only";
import { createHash, randomUUID } from "crypto";
import { headers } from "next/headers";

export async function requestContext() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || "unknown";
  const requestId = h.get("x-request-id") || randomUUID();
  const userAgent = h.get("user-agent") || undefined;
  return { ip, requestId, userAgent };
}

export function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
