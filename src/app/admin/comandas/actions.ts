"use server";

import { AuditAction, CashTransactionType, OrderItemStatus, OrderStatus, Prisma, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { addOrderItemSchema } from "@/lib/orders/schema";
import { productStock } from "@/lib/stock/utils";
import { withSerializableRetry } from "@/lib/server/transaction";

export type OrderActionState = { error?: string; success?: string; fieldErrors?: Record<string,string[]|undefined> };

async function recalcOrder(tx: Prisma.TransactionClient, orderId: string) {
  const items=await tx.orderItem.findMany({where:{orderId,status:OrderItemStatus.ACTIVE},select:{totalPrice:true}});
  const subtotal=items.reduce((sum,i)=>sum+Number(i.totalPrice),0);
  const order=await tx.order.findUniqueOrThrow({where:{id:orderId},select:{discountAmount:true}});
  const total=Math.max(0,subtotal-Number(order.discountAmount));
  return tx.order.update({where:{id:orderId},data:{subtotal,totalAmount:total}});
}

export async function addOrderItem(_:OrderActionState,formData:FormData):Promise<OrderActionState>{
  const session=await requirePermission(PERMISSIONS.ORDERS_MANAGE); const parsed=addOrderItemSchema.safeParse(Object.fromEntries(formData)); if(!parsed.success)return {fieldErrors:parsed.error.flatten().fieldErrors};
  const {orderId,productId,quantity}=parsed.data;
  try { await prisma.$transaction(async tx=>{
    const order=await tx.order.findUnique({where:{id:orderId}}); if(!order||order.status!==OrderStatus.OPEN)throw new Error("ORDER_NOT_OPEN");
    const product=await tx.product.findUnique({where:{id:productId}}); if(!product||!product.active)throw new Error("PRODUCT_UNAVAILABLE");
    const balance=await productStock(tx,productId); if(quantity>balance)throw new Error("INSUFFICIENT_STOCK");
    const total=Number(product.salePrice)*quantity;
    const item=await tx.orderItem.create({data:{orderId,productId,productName:product.name,quantity,unitPrice:product.salePrice,totalPrice:total}});
    await tx.stockMovement.create({data:{productId,eventId:order.eventId,orderItemId:item.id,type:StockMovementType.ORDER_CONSUMPTION,quantity,referenceType:"ORDER_ITEM",referenceId:item.id,createdById:session.user.id,notes:`Consumo da comanda ${order.id}.`}});
    await recalcOrder(tx,orderId);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}); } catch(e){const m=e instanceof Error?e.message:""; if(m==="INSUFFICIENT_STOCK")return {error:"Estoque insuficiente para este consumo."}; if(m==="ORDER_NOT_OPEN")return {error:"A comanda não está aberta para alterações."}; if(m==="PRODUCT_UNAVAILABLE")return {error:"Produto indisponível."}; throw e;}
  await writeAuditLog({actorUserId:session.user.id,action:AuditAction.CREATE,entityType:"OrderItem",entityId:orderId,description:"Consumo adicionado à comanda."}); revalidatePath(`/admin/comandas/${orderId}`); revalidatePath('/admin/comandas'); return {success:"Consumo adicionado."};
}

export async function cancelOrderItem(itemId:string){
  const session=await requirePermission(PERMISSIONS.ORDERS_MANAGE);
  const item=await prisma.orderItem.findUnique({where:{id:itemId},include:{order:true,stockMovements:{where:{type:StockMovementType.ORDER_CONSUMPTION},orderBy:{createdAt:"asc"},take:1}}});
  if(!item||item.status!==OrderItemStatus.ACTIVE)throw new Error("ITEM_NOT_FOUND"); if(item.order.status!==OrderStatus.OPEN)throw new Error("ORDER_NOT_OPEN"); const movement=item.stockMovements[0]; if(!movement)throw new Error("STOCK_MOVEMENT_NOT_FOUND");
  await prisma.$transaction(async tx=>{
    await tx.orderItem.update({where:{id:itemId},data:{status:OrderItemStatus.CANCELED,canceledAt:new Date()}});
    await tx.stockMovement.create({data:{productId:item.productId,eventId:item.order.eventId,orderItemId:item.id,type:StockMovementType.ADJUSTMENT_IN,quantity:item.quantity,reversalOfId:movement.id,referenceType:"ORDER_ITEM_REVERSAL",referenceId:item.id,createdById:session.user.id,notes:`Devolução por cancelamento de item da comanda ${item.orderId}.`}});
    await recalcOrder(tx,item.orderId);
  });
  await writeAuditLog({actorUserId:session.user.id,action:AuditAction.CANCEL,entityType:"OrderItem",entityId:itemId,description:"Item da comanda cancelado com devolução ao estoque."}); revalidatePath(`/admin/comandas/${item.orderId}`); revalidatePath('/admin/comandas');
}

export async function closeOrder(orderId:string){
 const session=await requirePermission(PERMISSIONS.ORDERS_MANAGE); const order=await prisma.order.findUnique({where:{id:orderId},include:{items:{where:{status:OrderItemStatus.ACTIVE}}}}); if(!order||order.status!==OrderStatus.OPEN)throw new Error("ORDER_NOT_OPEN"); if(!order.items.length)throw new Error("ORDER_EMPTY");
 const updated=await prisma.$transaction(async tx=>{const recalculated=await recalcOrder(tx,orderId); return tx.order.update({where:{id:orderId},data:{status:OrderStatus.AWAITING_PAYMENT,closedAt:new Date(),subtotal:recalculated.subtotal,totalAmount:recalculated.totalAmount}})});
 await writeAuditLog({actorUserId:session.user.id,action:AuditAction.UPDATE,entityType:"Order",entityId:orderId,description:"Comanda fechada e enviada para pagamento.",newData:{status:updated.status,totalAmount:updated.totalAmount.toString()}}); revalidatePath(`/admin/comandas/${orderId}`); revalidatePath(`/comanda/${order.publicToken}`); revalidatePath('/admin/comandas');
}

export async function reopenOrder(orderId:string){
 const session=await requirePermission(PERMISSIONS.ORDERS_MANAGE); const order=await prisma.order.findUnique({where:{id:orderId}}); if(!order||order.status!==OrderStatus.AWAITING_PAYMENT)throw new Error("ORDER_CANNOT_REOPEN"); await prisma.order.update({where:{id:orderId},data:{status:OrderStatus.OPEN,closedAt:null}}); await writeAuditLog({actorUserId:session.user.id,action:AuditAction.UPDATE,entityType:"Order",entityId:orderId,description:"Comanda reaberta antes da confirmação do pagamento."}); revalidatePath(`/admin/comandas/${orderId}`); revalidatePath(`/comanda/${order.publicToken}`);
}

export async function confirmOrderPayment(orderId:string){
 const session=await requirePermission(PERMISSIONS.ORDERS_PAYMENT); const order=await prisma.order.findUnique({where:{id:orderId}}); if(!order)throw new Error("ORDER_NOT_FOUND"); if(order.status===OrderStatus.PAID)return; if(order.status!==OrderStatus.AWAITING_PAYMENT)throw new Error("ORDER_NOT_AWAITING_PAYMENT"); if(Number(order.totalAmount)<=0)throw new Error("ORDER_HAS_NO_AMOUNT");
 const [category,pix,cash]=await Promise.all([prisma.cashCategory.findUnique({where:{name:"Comandas"}}),prisma.paymentMethod.findFirst({where:{type:"PIX",active:true}}),prisma.cashRegister.findFirst({where:{status:"OPEN"},orderBy:{openedAt:"desc"}})]); if(!category||!pix)throw new Error("PAYMENT_CONFIGURATION_NOT_FOUND");
 const committed=await withSerializableRetry(async tx=>{const fresh=await tx.order.findUnique({where:{id:orderId},select:{status:true}});if(!fresh||fresh.status===OrderStatus.PAID)return false;if(fresh.status!==OrderStatus.AWAITING_PAYMENT)throw new Error("ORDER_NOT_AWAITING_PAYMENT");await tx.cashTransaction.create({data:{sourceKey:`order-payment:${orderId}`,cashRegisterId:cash?.id,categoryId:category.id,paymentMethodId:pix.id,eventId:order.eventId,orderId,createdById:session.user.id,type:CashTransactionType.INCOME,amount:order.totalAmount,description:`Comanda - ${order.customerName}`}}); await tx.order.update({where:{id:orderId},data:{status:OrderStatus.PAID,paymentMethodId:pix.id,paidAt:new Date()}});return true;});if(!committed)return;
 await writeAuditLog({actorUserId:session.user.id,action:AuditAction.PAYMENT,entityType:"Order",entityId:orderId,description:"Pagamento PIX manual da comanda confirmado.",oldData:{status:order.status},newData:{status:OrderStatus.PAID,amount:order.totalAmount.toString()}}); revalidatePath(`/admin/comandas/${orderId}`); revalidatePath(`/comanda/${order.publicToken}`); revalidatePath('/admin/comandas');
}

export async function cancelOrder(orderId:string){
 const session=await requirePermission(PERMISSIONS.ORDERS_CANCEL); const order=await prisma.order.findUnique({where:{id:orderId},include:{items:{where:{status:OrderItemStatus.ACTIVE},include:{stockMovements:{where:{type:StockMovementType.ORDER_CONSUMPTION},take:1}}}}}); if(!order)throw new Error("ORDER_NOT_FOUND"); if(order.status===OrderStatus.PAID)throw new Error("PAID_ORDER_REQUIRES_FINANCIAL_REVERSAL"); if(order.status===OrderStatus.CANCELED)return;
 await prisma.$transaction(async tx=>{for(const item of order.items){const m=item.stockMovements[0]; await tx.orderItem.update({where:{id:item.id},data:{status:OrderItemStatus.CANCELED,canceledAt:new Date()}}); if(m)await tx.stockMovement.create({data:{productId:item.productId,eventId:order.eventId,orderItemId:item.id,type:StockMovementType.ADJUSTMENT_IN,quantity:item.quantity,reversalOfId:m.id,referenceType:"ORDER_CANCEL",referenceId:orderId,createdById:session.user.id,notes:`Devolução por cancelamento da comanda ${orderId}.`}});} await tx.order.update({where:{id:orderId},data:{status:OrderStatus.CANCELED,canceledAt:new Date()}});});
 await writeAuditLog({actorUserId:session.user.id,action:AuditAction.CANCEL,entityType:"Order",entityId:orderId,description:"Comanda cancelada; consumos devolvidos ao estoque."}); revalidatePath(`/admin/comandas/${orderId}`); revalidatePath(`/comanda/${order.publicToken}`); revalidatePath('/admin/comandas');
}
