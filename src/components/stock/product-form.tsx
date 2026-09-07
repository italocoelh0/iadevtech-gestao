"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { StockActionState } from "@/app/admin/estoque/actions";

type Category={id:string;name:string};
type Initial={name?:string;sku?:string|null;categoryId?:string|null;unit?:string;salePrice?:string|number;costPrice?:string|number|null;minimumStock?:string|number};
export function ProductForm({action,categories,initial}:{action:(state:StockActionState,data:FormData)=>Promise<StockActionState>;categories:Category[];initial?:Initial}){
 const [state,formAction,pending]=useActionState(action,{}); const err=(k:string)=>state.fieldErrors?.[k]?.[0];
 return <form action={formAction} className="space-y-5">
  {state.error&&<div className="rounded-md border p-3 text-sm">{state.error}</div>}
  <div className="grid gap-4 md:grid-cols-2"><Field label="Nome" name="name" defaultValue={initial?.name} error={err("name")}/><Field label="SKU" name="sku" defaultValue={initial?.sku??""} error={err("sku")}/><label className="space-y-1.5 text-sm"><span>Categoria</span><select name="categoryId" defaultValue={initial?.categoryId??""} className="input"><option value="">Sem categoria</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Field label="Unidade" name="unit" defaultValue={initial?.unit??"UN"} error={err("unit")}/><Field label="Preço de venda" name="salePrice" type="number" step="1" defaultValue={initial?.salePrice??"0"} error={err("salePrice")}/><Field label="Custo de referência" name="costPrice" type="number" step="1" defaultValue={initial?.costPrice??""} error={err("costPrice")}/><Field label="Estoque mínimo" name="minimumStock" type="number" step="1" defaultValue={initial?.minimumStock??"0"} error={err("minimumStock")}/></div>
  <Button disabled={pending}>{pending?"Salvando...":"Salvar produto"}</Button>
 </form>
}
function Field({label,error,...props}:any){return <label className="space-y-1.5 text-sm"><span>{label}</span><input className="input" {...props}/>{error&&<span className="text-xs text-red-600">{error}</span>}</label>}
