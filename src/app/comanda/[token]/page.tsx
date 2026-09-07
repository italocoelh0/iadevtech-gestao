import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stockBalances } from "@/lib/stock/balance";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { PixManual } from "@/components/registrations/pix-manual";
import { PublicOrderItemForm } from "@/components/orders/public-order-item-form";
import { ORDER_STATUS_LABELS, formatOrderMoney } from "@/lib/orders/utils";
import { closePublicOrder } from "./actions";

export default async function PublicOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await prisma.order.findUnique({
    where: { publicToken: token },
    include: {
      event: { select: { name: true } },
      items: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const [pix, dbProducts] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: "pix.key" } }),
    order.status === OrderStatus.OPEN
      ? prisma.product.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, salePrice: true, unit: true },
        })
      : Promise.resolve([]),
  ]);

  const balances = await stockBalances(dbProducts.map((product) => product.id));
  const products = dbProducts
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: product.salePrice.toString(),
      unit: product.unit,
      stock: balances.get(product.id) ?? 0,
    }))
    .filter((product) => product.stock > 0);

  return (
    <main className="min-h-screen bg-muted/30 p-4">
      <div className="mb-4"><Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">← Voltar para a página inicial</Link></div>
      <div className="mx-auto max-w-xl space-y-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{order.customerName}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {order.event?.name ?? "Reunião / consumo avulso"}
                </p>
              </div>
              <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 border-b pb-3 text-sm">
                  <div>
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-muted-foreground">
                      {Number(item.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} × {formatOrderMoney(item.unitPrice)}
                    </div>
                  </div>
                  <strong>{formatOrderMoney(item.totalPrice)}</strong>
                </div>
              ))}
              {!order.items.length ? <p className="text-sm text-muted-foreground">Nenhum consumo lançado ainda.</p> : null}
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-4">
              <span className="font-medium">Total</span>
              <span className="text-2xl font-bold">{formatOrderMoney(order.totalAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {order.status === OrderStatus.OPEN ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Lançar consumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Selecione o que você consumiu. Preços e estoque são validados pelo sistema no momento do lançamento.
                </p>
                <PublicOrderItemForm token={token} products={products} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Finalizar consumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Confira os itens acima antes de fechar. Depois do fechamento, somente a equipe poderá reabrir ou corrigir a comanda.
                </p>
                <form action={closePublicOrder.bind(null, token)}>
                  <SubmitButton className="w-full" pendingText="Fechando comanda..." disabled={!order.items.length}>
                    Fechar minha comanda
                  </SubmitButton>
                </form>
                {!order.items.length ? (
                  <p className="text-center text-xs text-muted-foreground">Adicione ao menos um consumo para fechar a comanda.</p>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}

        {order.status === OrderStatus.AWAITING_PAYMENT && pix?.value ? (
          <Card>
            <CardHeader><CardTitle>Pagamento via PIX</CardTitle></CardHeader>
            <CardContent>
              <PixManual pixKey={pix.value} />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Após o pagamento, a confirmação continua sendo feita manualmente pela equipe.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {order.status === OrderStatus.PAID ? (
          <Card><CardContent className="pt-6 text-center"><div className="text-lg font-semibold">Pagamento confirmado</div><p className="mt-1 text-sm text-muted-foreground">Sua comanda está encerrada e paga.</p></CardContent></Card>
        ) : null}

        {order.status === OrderStatus.CANCELED ? (
          <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">Esta comanda foi cancelada.</CardContent></Card>
        ) : null}
      </div>
    </main>
  );
}
