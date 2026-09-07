"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createStockMovement, type StockActionState } from "@/app/admin/estoque/actions";
export function MovementForm({products,events,defaultProductId}:{products:{id:string;name:string;unit:string}[];events:{id:string;name:string}[];defaultProductId?:string}){
 const [state,action,pending]=useActionState(createStockMovement,{} as StockActionState); const err=(k:string)=>state.fieldErrors?.[k]?.[0];
 return <form action={action} className="space-y-4">{state.error&&<div className="rounded-md border p-3 text-sm">{state.error}</div>}{state.success&&<div className="rounded-md border p-3 text-sm">{state.success}</div>}
 <div className="grid gap-4 md:grid-cols-2"><label className="space-y-1.5 text-sm"><span>Produto</span><select name="productId" defaultValue={defaultProductId??""} className="input" required><option value="">Selecione</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}</select>{err("productId")&&<small>{err("productId")}</small>}</label>
 <label className="space-y-1.5 text-sm"><span>Tipo</span><select name="type" className="input" defaultValue="PURCHASE"><option value="PURCHASE">Compra / entrada</option><option value="DONATION">Doação / entrada</option><option value="RETURN">Devolução / entrada</option><option value="LOSS">Perda / saída</option><option value="DAMAGE">Avaria / saída</option><option value="INTERNAL_USE">Uso interno / saída</option><option value="EVENT_TRANSFER">Envio para evento / saída</option><option value="EVENT_RETURN">Retorno de evento / entrada</option><option value="ADJUSTMENT_IN">Ajuste de entrada</option><option value="ADJUSTMENT_OUT">Ajuste de saída</option></select>{err("type")&&<small>{err("type")}</small>}</label>
 <label className="space-y-1.5 text-sm"><span>Quantidade</span><input name="quantity" type="number" min="1" step="1" className="input" required/>{err("quantity")&&<small>{err("quantity")}</small>}</label>
 <label className="space-y-1.5 text-sm"><span>Custo unitário (opcional)</span><input name="unitCost" type="number" min="0" step="1" className="input"/>{err("unitCost")&&<small>{err("unitCost")}</small>}</label>
 <label className="space-y-1.5 text-sm md:col-span-2"><span>Evento (opcional)</span><select name="eventId" className="input"><option value="">Sem vínculo</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
 <label className="space-y-1.5 text-sm md:col-span-2"><span>Observações</span><textarea name="notes" className="input min-h-24"/></label></div><Button disabled={pending}>{pending?"Registrando...":"Registrar movimentação"}</Button></form>
}
