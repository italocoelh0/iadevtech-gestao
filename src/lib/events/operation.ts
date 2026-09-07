import { CheckinStatus, EventStatus, OrderStatus, RegistrationStatus, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cashSummary } from "@/lib/reports/data";

export async function getEventOperation(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, status: true, startsAt: true, endsAt: true, capacity: true },
  });
  if (!event) return null;

  const [registrations, orders, consumptionRows, finance] = await Promise.all([
    prisma.eventRegistration.findMany({
      where: { eventId, status: { notIn: [RegistrationStatus.CANCELED, RegistrationStatus.WAITLIST] } },
      select: {
        id: true,
        status: true,
        participants: {
          select: {
            id: true,
            name: true,
            phone: true,
            registrationType: { select: { name: true } },
            checkins: {
              where: { status: CheckinStatus.CHECKED_IN },
              orderBy: { checkedInAt: "desc" },
              take: 1,
              select: { id: true, checkedInAt: true },
            },
          },
        },
      },
    }),
    prisma.order.findMany({
      where: { eventId, status: { in: [OrderStatus.OPEN, OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_PROCESSING] } },
      select: { id: true, status: true, customerName: true, totalAmount: true },
      orderBy: { openedAt: "desc" },
    }),
    prisma.stockMovement.groupBy({
      by: ["productId"],
      where: { eventId, type: StockMovementType.ORDER_CONSUMPTION },
      _sum: { quantity: true },
    }),
    cashSummary(new Date(2000, 0, 1), new Date(2100, 0, 1), eventId),
  ]);

  const productIds = consumptionRows.map((row) => row.productId);
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    : [];
  const productMap = new Map(products.map((product) => [product.id, product.name]));

  const participants = registrations.flatMap((registration) =>
    registration.participants.map((participant) => ({ ...participant, registrationStatus: registration.status })),
  );
  const present = participants.filter((participant) => participant.checkins.length > 0).length;
  const unpaidRegistrations = registrations.filter((registration) =>
    registration.status === RegistrationStatus.PENDING || registration.status === RegistrationStatus.AWAITING_PAYMENT,
  );

  const blockers = [
    ...(orders.length ? [`${orders.length} comanda(s) ainda aberta(s) ou aguardando pagamento`] : []),
    ...(unpaidRegistrations.length ? [`${unpaidRegistrations.length} inscrição(ões) com pagamento pendente`] : []),
  ];

  return {
    event,
    participants,
    present,
    absent: Math.max(0, participants.length - present),
    openOrders: orders,
    unpaidRegistrations,
    finance,
    blockers,
    canFinish: blockers.length === 0 && event.status === EventStatus.IN_PROGRESS,
    consumption: consumptionRows
      .map((row) => ({ name: productMap.get(row.productId) ?? "Produto", quantity: Number(row._sum.quantity ?? 0) }))
      .sort((a, b) => b.quantity - a.quantity),
  };
}
