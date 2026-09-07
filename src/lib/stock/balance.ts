import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signedQuantity } from "@/lib/stock/utils";

type DbLike = Pick<Prisma.TransactionClient, "stockMovement">;

export async function stockBalances(productIds?: string[], db: DbLike = prisma) {
  if (productIds && productIds.length === 0) return new Map<string, number>();

  const grouped = await db.stockMovement.groupBy({
    by: ["productId", "type"],
    where: productIds ? { productId: { in: productIds } } : undefined,
    _sum: { quantity: true },
  });

  const balances = new Map<string, number>();
  for (const row of grouped) {
    balances.set(
      row.productId,
      (balances.get(row.productId) ?? 0) + signedQuantity(row.type, row._sum.quantity ?? 0),
    );
  }
  return balances;
}
