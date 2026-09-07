"use server";

import { AuditAction, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { categorySchema, movementSchema, productSchema } from "@/lib/stock/schema";
import { productStock, STOCK_OUT_TYPES } from "@/lib/stock/utils";

export type StockActionState = { error?: string; success?: string; fieldErrors?: Record<string,string[]|undefined> };

export async function createProduct(_: StockActionState, formData: FormData): Promise<StockActionState> {
  const session=await requirePermission(PERMISSIONS.STOCK_PRODUCTS);
  const parsed=productSchema.safeParse(Object.fromEntries(formData));
  if(!parsed.success)return {fieldErrors:parsed.error.flatten().fieldErrors};
  const d=parsed.data;
  if(d.sku){const exists=await prisma.product.findUnique({where:{sku:d.sku}});if(exists)return {error:"Já existe um produto com este SKU."};}
  const product=await prisma.product.create({data:{name:d.name,sku:d.sku||null,categoryId:d.categoryId||null,unit:d.unit.toUpperCase(),salePrice:d.salePrice,costPrice:d.costPrice??null,minimumStock:d.minimumStock}});
  await writeAuditLog({actorUserId:session.user.id,action:AuditAction.CREATE,entityType:"Product",entityId:product.id,description:`Produto ${product.name} criado.`,newData:product});
  revalidatePath("/admin/estoque"); redirect(`/admin/estoque/produtos/${product.id}?created=1`);
}

export async function updateProduct(id:string,_:StockActionState,formData:FormData):Promise<StockActionState>{
  const session=await requirePermission(PERMISSIONS.STOCK_PRODUCTS);
  const parsed=productSchema.safeParse(Object.fromEntries(formData)); if(!parsed.success)return {fieldErrors:parsed.error.flatten().fieldErrors};
  const previous=await prisma.product.findUnique({where:{id}}); if(!previous)return {error:"Produto não encontrado."};
  const d=parsed.data; if(d.sku){const exists=await prisma.product.findFirst({where:{sku:d.sku,NOT:{id}}});if(exists)return {error:"Já existe outro produto com este SKU."};}
  const product=await prisma.product.update({where:{id},data:{name:d.name,sku:d.sku||null,categoryId:d.categoryId||null,unit:d.unit.toUpperCase(),salePrice:d.salePrice,costPrice:d.costPrice??null,minimumStock:d.minimumStock}});
  await writeAuditLog({actorUserId:session.user.id,action:AuditAction.UPDATE,entityType:"Product",entityId:id,description:`Produto ${product.name} atualizado.`,oldData:previous,newData:product});
  revalidatePath("/admin/estoque"); revalidatePath(`/admin/estoque/produtos/${id}`); redirect(`/admin/estoque/produtos/${id}?updated=1`);
}

export async function toggleProduct(id:string){
  const session=await requirePermission(PERMISSIONS.STOCK_PRODUCTS); const previous=await prisma.product.findUnique({where:{id}}); if(!previous)throw new Error("PRODUCT_NOT_FOUND");
  const product=await prisma.product.update({where:{id},data:{active:!previous.active}});
  await writeAuditLog({actorUserId:session.user.id,action:AuditAction.UPDATE,entityType:"Product",entityId:id,description:`Produto ${product.name} ${product.active?"ativado":"inativado"}.`,oldData:{active:previous.active},newData:{active:product.active}});
  revalidatePath("/admin/estoque"); revalidatePath(`/admin/estoque/produtos/${id}`);
}

export async function createStockMovement(_:StockActionState,formData:FormData):Promise<StockActionState>{
  const session=await requirePermission(PERMISSIONS.STOCK_MOVEMENTS); const parsed=movementSchema.safeParse(Object.fromEntries(formData)); if(!parsed.success)return {fieldErrors:parsed.error.flatten().fieldErrors};
  const d=parsed.data; const product=await prisma.product.findUnique({where:{id:d.productId}}); if(!product||!product.active)return {error:"Produto não encontrado ou inativo."};
  if(d.eventId){const event=await prisma.event.findUnique({where:{id:d.eventId},select:{id:true}});if(!event)return {error:"Evento não encontrado."};}
  if(STOCK_OUT_TYPES.includes(d.type as StockMovementType)){
    const balance=await prisma.$transaction(tx=>productStock(tx,d.productId));
    if(d.quantity>balance)return {error:`Estoque insuficiente. Saldo atual: ${balance.toLocaleString("pt-BR",{maximumFractionDigits:3})} ${product.unit}.`};
  }
  const movement=await prisma.stockMovement.create({data:{productId:d.productId,eventId:d.eventId||null,type:d.type as StockMovementType,quantity:d.quantity,unitCost:d.unitCost??null,notes:d.notes||null,createdById:session.user.id,referenceType:"MANUAL"}});
  await writeAuditLog({actorUserId:session.user.id,action:(movement.type==="ADJUSTMENT_IN"||movement.type==="ADJUSTMENT_OUT")?AuditAction.STOCK_ADJUSTMENT:AuditAction.CREATE,entityType:"StockMovement",entityId:movement.id,description:`Movimentação de estoque registrada para ${product.name}.`,newData:movement});
  revalidatePath("/admin/estoque"); revalidatePath(`/admin/estoque/produtos/${product.id}`); return {success:"Movimentação registrada."};
}

export async function reverseStockMovement(id:string){
  const session=await requirePermission(PERMISSIONS.STOCK_ADJUST);
  const original=await prisma.stockMovement.findUnique({where:{id},include:{product:true,reversals:true}}); if(!original)throw new Error("MOVEMENT_NOT_FOUND"); if(original.reversals.length)throw new Error("MOVEMENT_ALREADY_REVERSED");
  const opposite:Record<string,StockMovementType>={PURCHASE:"ADJUSTMENT_OUT",DONATION:"ADJUSTMENT_OUT",RETURN:"ADJUSTMENT_OUT",ADJUSTMENT_IN:"ADJUSTMENT_OUT",EVENT_RETURN:"ADJUSTMENT_OUT",ORDER_CONSUMPTION:"ADJUSTMENT_IN",LOSS:"ADJUSTMENT_IN",DAMAGE:"ADJUSTMENT_IN",INTERNAL_USE:"ADJUSTMENT_IN",ADJUSTMENT_OUT:"ADJUSTMENT_IN",EVENT_TRANSFER:"ADJUSTMENT_IN"};
  const reversal=await prisma.stockMovement.create({data:{productId:original.productId,eventId:original.eventId,type:opposite[original.type],quantity:original.quantity,unitCost:original.unitCost,createdById:session.user.id,reversalOfId:original.id,referenceType:"REVERSAL",referenceId:original.id,notes:`Estorno da movimentação ${original.id}.`}});
  await writeAuditLog({actorUserId:session.user.id,action:AuditAction.STOCK_ADJUSTMENT,entityType:"StockMovement",entityId:reversal.id,description:`Movimentação de ${original.product.name} estornada.`,oldData:original,newData:reversal});
  revalidatePath("/admin/estoque"); revalidatePath(`/admin/estoque/produtos/${original.productId}`);
}

export async function createProductCategory(_:StockActionState,formData:FormData):Promise<StockActionState>{
  const session=await requirePermission(PERMISSIONS.STOCK_SETTINGS); const parsed=categorySchema.safeParse(Object.fromEntries(formData)); if(!parsed.success)return {fieldErrors:parsed.error.flatten().fieldErrors};
  const exists=await prisma.productCategory.findUnique({where:{name:parsed.data.name}}); if(exists)return {error:"Já existe uma categoria com este nome."};
  const category=await prisma.productCategory.create({data:{name:parsed.data.name,description:parsed.data.description||null}});
  await writeAuditLog({actorUserId:session.user.id,action:AuditAction.CREATE,entityType:"ProductCategory",entityId:category.id,description:`Categoria ${category.name} criada.`,newData:category}); revalidatePath("/admin/estoque"); revalidatePath("/admin/estoque/categorias"); return {success:"Categoria criada."};
}

export async function toggleProductCategory(id:string){
  const session=await requirePermission(PERMISSIONS.STOCK_SETTINGS); const prev=await prisma.productCategory.findUnique({where:{id}}); if(!prev)throw new Error("CATEGORY_NOT_FOUND");
  const category=await prisma.productCategory.update({where:{id},data:{active:!prev.active}}); await writeAuditLog({actorUserId:session.user.id,action:AuditAction.UPDATE,entityType:"ProductCategory",entityId:id,description:`Categoria ${category.name} ${category.active?"ativada":"inativada"}.`,oldData:{active:prev.active},newData:{active:category.active}}); revalidatePath("/admin/estoque");revalidatePath("/admin/estoque/categorias");
}
