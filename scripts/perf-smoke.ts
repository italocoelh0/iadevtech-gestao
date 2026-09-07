import { prisma } from "../src/lib/prisma";
import { getDashboardData, getEventsReport, getStockReport } from "../src/lib/reports/data";

async function measure<T>(name: string, fn: () => Promise<T>) {
  const start = performance.now();
  await fn();
  const elapsed = Math.round(performance.now() - start);
  console.log(`${name.padEnd(24)} ${elapsed} ms`);
  return elapsed;
}

async function main() {
  console.log("Performance smoke test (mesmo banco configurado em DATABASE_URL)\n");
  await measure("Dashboard", getDashboardData);
  await measure("Relatório estoque", getStockReport);
  await measure("Relatório eventos", getEventsReport);
}

main().finally(async () => prisma.$disconnect());
