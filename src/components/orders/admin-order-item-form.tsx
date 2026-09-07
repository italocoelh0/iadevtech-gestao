"use client";
import { useActionState } from "react";
import { addOrderItem, type OrderActionState } from "@/app/admin/comandas/actions";
import { Button } from "@/components/ui/button";
const initial:OrderActionState={};
export function AdminOrderItemForm({orderId,products}:{orderId:string;products:{id:string;name:string;salePrice:string;stock:number;unit:string}[]}){const [state,action,pending]=useActionState(addOrderItem,initial);return <form action={action} className="grid gap-3 md:grid-cols-[1fr_140px_auto]"><input type="hidden" name="orderId" value={orderId}/><select name="productId" className="input" required defaultValue=""><option value="" disabled>Selecione o produto</option>{products.map(p=><option key={p.id} value={p.id} disabled={p.stock<=0}>{p.name} — estoque {p.stock.toLocaleString("pt-BR",{maximumFractionDigits:3})} {p.unit}</option>)}</select><input name="quantity" type="number" min="1" step="1" defaultValue="1" className="input" required/><Button disabled={pending}>{pending?"Adicionando...":"Adicionar"}</Button>{state.error&&<p className="text-sm text-red-600 md:col-span-3">{state.error}</p>}</form>}
