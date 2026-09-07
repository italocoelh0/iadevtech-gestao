import { CashTransactionType, EventStatus, FeeStatus, OrderStatus, RegistrationStatus, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateRange, startOfMonth, endOfMonth } from "@/lib/reports/utils";
import { movementFactor } from "@/lib/stock/utils";

function originalType(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const value = (metadata as Record<string, unknown>).originalType;
  return typeof value === "string" ? value : undefined;
}

export async function cashSummary(start: Date, end: Date, eventId?: string) {
  const where = { occurredAt: { gte: start, lte: end }, ...(eventId ? { eventId } : {}) };
  const [grouped, reversals] = await Promise.all([
    prisma.cashTransaction.groupBy({
      by: ["type"],
      where: { ...where, type: { in: [CashTransactionType.INCOME, CashTransactionType.EXPENSE] } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.cashTransaction.findMany({
      where: { ...where, type: CashTransactionType.REVERSAL },
      select: { amount: true, metadata: true },
    }),
  ]);

  const amount = (type: CashTransactionType) => Number(grouped.find((row) => row.type === type)?._sum.amount ?? 0);
  let income = amount(CashTransactionType.INCOME);
  let expense = amount(CashTransactionType.EXPENSE);
  for (const row of reversals) {
    const value = Number(row.amount);
    const source = originalType(row.metadata);
    if (source === "INCOME") income -= value;
    if (source === "EXPENSE") expense -= value;
  }
  const count = grouped.reduce((sum, row) => sum + row._count, 0) + reversals.length;
  return { income, expense, balance: income - expense, count };
}

export async function getDashboardData() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const next60 = new Date(now);
  next60.setDate(next60.getDate() + 60);

  const [membersActive, feesPending, feesPaid, upcomingEvents, openOrders, financial, products, movements] = await Promise.all([
    prisma.member.count({ where: { status: "ACTIVE" } }),
    prisma.membershipFee.aggregate({ where: { status: "PENDING", competencyYear: now.getFullYear(), competencyMonth: now.getMonth() + 1 }, _count: true, _sum: { amount: true } }),
    prisma.membershipFee.aggregate({ where: { status: "PAID", competencyYear: now.getFullYear(), competencyMonth: now.getMonth() + 1 }, _count: true, _sum: { amount: true } }),
    prisma.event.findMany({ where: { startsAt: { gte: now, lte: next60 }, status: { notIn: [EventStatus.CANCELED, EventStatus.FINISHED] } }, orderBy: { startsAt: "asc" }, take: 5, select: { id: true, name: true, startsAt: true, status: true, capacity: true } }),
    prisma.order.aggregate({ where: { status: { in: [OrderStatus.OPEN, OrderStatus.AWAITING_PAYMENT] } }, _count: true, _sum: { totalAmount: true } }),
    cashSummary(monthStart, monthEnd),
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true, minimumStock: true } }),
    prisma.stockMovement.groupBy({ by: ["productId", "type"], _sum: { quantity: true } }),
  ]);

  const balances = new Map<string, number>();
  for (const m of movements) {
    const factor = movementFactor(m.type);
    balances.set(m.productId, (balances.get(m.productId) ?? 0) + factor * Number(m._sum.quantity ?? 0));
  }
  const lowStock = products
    .map((p) => ({ id: p.id, name: p.name, balance: balances.get(p.id) ?? 0, minimum: Number(p.minimumStock) }))
    .filter((p) => p.balance <= p.minimum)
    .sort((a, b) => a.balance - b.balance)
    .slice(0, 8);

  return {
    membersActive,
    fees: { pendingCount: feesPending._count, pendingAmount: Number(feesPending._sum.amount ?? 0), paidCount: feesPaid._count, paidAmount: Number(feesPaid._sum.amount ?? 0) },
    upcomingEvents,
    orders: { openCount: openOrders._count, openAmount: Number(openOrders._sum.totalAmount ?? 0) },
    financial,
    lowStock,
  };
}

export async function getFinanceReport(from?: string, to?: string) {
  const { start, end } = parseDateRange(from, to);
  const [summary, categories, methods] = await Promise.all([
    cashSummary(start, end),
    prisma.cashTransaction.groupBy({ by: ["categoryId", "type"], where: { occurredAt: { gte: start, lte: end }, type: { in: [CashTransactionType.INCOME, CashTransactionType.EXPENSE] } }, _sum: { amount: true }, _count: true }),
    prisma.cashTransaction.groupBy({ by: ["paymentMethodId", "type"], where: { occurredAt: { gte: start, lte: end }, type: { in: [CashTransactionType.INCOME, CashTransactionType.EXPENSE] } }, _sum: { amount: true }, _count: true }),
  ]);
  const categoryRows = await prisma.cashCategory.findMany({ where: { id: { in: categories.map((c) => c.categoryId) } }, select: { id: true, name: true } });
  const methodIds = methods.map((m) => m.paymentMethodId).filter((id): id is string => Boolean(id));
  const methodRows = await prisma.paymentMethod.findMany({ where: { id: { in: methodIds } }, select: { id: true, name: true } });
  const categoryMap = new Map(categoryRows.map((c) => [c.id, c.name]));
  const methodMap = new Map(methodRows.map((m) => [m.id, m.name]));
  return {
    start, end, summary,
    categories: categories.map((c) => ({ name: categoryMap.get(c.categoryId) ?? "Categoria", type: c.type, amount: Number(c._sum.amount ?? 0), count: c._count })).sort((a,b)=>b.amount-a.amount),
    methods: methods.map((m) => ({ name: m.paymentMethodId ? (methodMap.get(m.paymentMethodId) ?? "Forma") : "Não informada", type: m.type, amount: Number(m._sum.amount ?? 0), count: m._count })).sort((a,b)=>b.amount-a.amount),
  };
}

export async function getFeesReport(year?: number, month?: number) {
  const now = new Date();
  const y = year && year >= 2000 ? year : now.getFullYear();
  const m = month && month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  const grouped = await prisma.membershipFee.groupBy({ by: ["status"], where: { competencyYear: y, competencyMonth: m }, _count: true, _sum: { amount: true } });
  const overdue = await prisma.membershipFee.findMany({ where: { status: FeeStatus.PENDING, dueDate: { lt: now } }, include: { member: { select: { id: true, fullName: true, phone: true } } }, orderBy: { dueDate: "asc" }, take: 30 });
  const row = (status: FeeStatus) => grouped.find((g) => g.status === status);
  return {
    year: y, month: m,
    pending: { count: row(FeeStatus.PENDING)?._count ?? 0, amount: Number(row(FeeStatus.PENDING)?._sum.amount ?? 0) },
    paid: { count: row(FeeStatus.PAID)?._count ?? 0, amount: Number(row(FeeStatus.PAID)?._sum.amount ?? 0) },
    exempt: { count: row(FeeStatus.EXEMPT)?._count ?? 0, amount: Number(row(FeeStatus.EXEMPT)?._sum.amount ?? 0) },
    canceled: { count: row(FeeStatus.CANCELED)?._count ?? 0, amount: Number(row(FeeStatus.CANCELED)?._sum.amount ?? 0) },
    overdue: overdue.map((f) => ({ id: f.id, member: f.member.fullName, phone: f.member.phone, dueDate: f.dueDate, amount: Number(f.amount), year: f.competencyYear, month: f.competencyMonth })),
  };
}

export async function getStockReport() {
  const [products, balances, consumption] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, include: { category: true }, orderBy: { name: "asc" } }),
    prisma.stockMovement.groupBy({ by: ["productId", "type"], _sum: { quantity: true } }),
    prisma.stockMovement.groupBy({ by: ["productId"], where: { type: StockMovementType.ORDER_CONSUMPTION }, _sum: { quantity: true } }),
  ]);
  const balanceMap = new Map<string, number>();
  for (const b of balances) {
    const factor = movementFactor(b.type);
    balanceMap.set(b.productId, (balanceMap.get(b.productId) ?? 0) + factor * Number(b._sum.quantity ?? 0));
  }
  const consumedMap = new Map(consumption.map((b) => [b.productId, Math.abs(Number(b._sum.quantity ?? 0))]));
  return products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, unit: p.unit, category: p.category?.name ?? "—", balance: balanceMap.get(p.id) ?? 0, minimum: Number(p.minimumStock), consumed: consumedMap.get(p.id) ?? 0, salePrice: Number(p.salePrice) })).sort((a,b)=>b.consumed-a.consumed);
}

export async function getEventsReport() {
  const events = await prisma.event.findMany({
    where: { status: { not: EventStatus.DRAFT } },
    orderBy: { startsAt: "desc" },
    take: 50,
    include: {
      registrations: { where: { status: { notIn: [RegistrationStatus.CANCELED, RegistrationStatus.WAITLIST] } }, select: { participantCount: true, finalAmount: true, status: true } },
      orders: { select: { status: true, totalAmount: true } },
    },
  });
  if (!events.length) return [];

  const eventIds = events.map((event) => event.id);
  const [cashGrouped, reversals] = await Promise.all([
    prisma.cashTransaction.groupBy({
      by: ["eventId", "type"],
      where: { eventId: { in: eventIds }, type: { in: [CashTransactionType.INCOME, CashTransactionType.EXPENSE] } },
      _sum: { amount: true },
    }),
    prisma.cashTransaction.findMany({
      where: { eventId: { in: eventIds }, type: CashTransactionType.REVERSAL },
      select: { eventId: true, amount: true, metadata: true },
    }),
  ]);

  const finance = new Map<string, { income: number; expense: number }>();
  for (const row of cashGrouped) {
    if (!row.eventId) continue;
    const item = finance.get(row.eventId) ?? { income: 0, expense: 0 };
    if (row.type === CashTransactionType.INCOME) item.income += Number(row._sum.amount ?? 0);
    if (row.type === CashTransactionType.EXPENSE) item.expense += Number(row._sum.amount ?? 0);
    finance.set(row.eventId, item);
  }
  for (const row of reversals) {
    if (!row.eventId) continue;
    const item = finance.get(row.eventId) ?? { income: 0, expense: 0 };
    const source = originalType(row.metadata);
    if (source === "INCOME") item.income -= Number(row.amount);
    if (source === "EXPENSE") item.expense -= Number(row.amount);
    finance.set(row.eventId, item);
  }

  return events.map((event) => {
    const cash = finance.get(event.id) ?? { income: 0, expense: 0 };
    const participants = event.registrations.reduce((sum, registration) => sum + registration.participantCount, 0);
    const registrationsPaid = event.registrations.filter((registration) => registration.status === RegistrationStatus.PAID).reduce((sum, registration) => sum + Number(registration.finalAmount), 0);
    const orderRevenue = event.orders.filter((order) => order.status === OrderStatus.PAID).reduce((sum, order) => sum + Number(order.totalAmount), 0);
    return { id: event.id, name: event.name, startsAt: event.startsAt, status: event.status, capacity: event.capacity, participants, registrationsPaid, orderRevenue, income: cash.income, expense: cash.expense, result: cash.income - cash.expense };
  });
}
