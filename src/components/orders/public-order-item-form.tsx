"use client";

import { useActionState } from "react";
import { addPublicOrderItem, type PublicOrderActionState } from "@/app/comanda/[token]/actions";
import { Button } from "@/components/ui/button";

const initialState: PublicOrderActionState = {};

export function PublicOrderItemForm({
  token,
  products,
}: {
  token: string;
  products: { id: string; name: string; price: string; stock: number; unit: string }[];
}) {
  const [state, action, pending] = useActionState(addPublicOrderItem, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
        <select name="productId" className="input" required defaultValue="">
          <option value="" disabled>Selecione o produto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id} disabled={product.stock <= 0}>
              {product.name} — R$ {Number(product.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </option>
          ))}
        </select>
        <input
          name="quantity"
          type="number"
          min="1"
          max="50"
          step="1"
          defaultValue="1"
          className="input"
          required
          aria-label="Quantidade"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending || products.length === 0}>
        {pending ? "Adicionando..." : "Adicionar consumo"}
      </Button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">{state.success}</p> : null}
      {products.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum produto com estoque disponível.</p> : null}
    </form>
  );
}
