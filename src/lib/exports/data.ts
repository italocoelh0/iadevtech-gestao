import { prisma } from "@/lib/prisma";
import { getEventsReport, getFeesReport, getStockReport } from "@/lib/reports/data";
import { parseDateRange } from "@/lib/reports/utils";

const brDate = (d: Date | null | undefined) => d ? new Intl.DateTimeFormat("pt-BR").format(d) : "";

export async function exportMembers() {
  const rows = await prisma.member.findMany({ orderBy: { fullName: "asc" } });
  return rows.map(r => ({ nome:r.fullName, telefone:r.phone??"", email:r.email??"", tipoSanguineo:r.bloodType, nascimento:brDate(r.birthDate), cidade:r.city??"", uf:r.state??"", ingresso:brDate(r.joinedAt), status:r.status }));
}
export async function exportFees(year?: number, month?: number) {
  const now=new Date(); const y=year||now.getFullYear(); const m=month||now.getMonth()+1;
  const rows=await prisma.membershipFee.findMany({where:{competencyYear:y,competencyMonth:m},include:{member:true,paymentMethod:true},orderBy:{member:{fullName:"asc"}}});
  return rows.map(r=>({membro:r.member.fullName,competencia:`${String(m).padStart(2,"0")}/${y}`,valor:Number(r.amount),vencimento:brDate(r.dueDate),pagoEm:brDate(r.paidAt),status:r.status,forma:r.paymentMethod?.name??""}));
}
export async function exportFinance(from?: string,to?: string) {
  const {start,end}=parseDateRange(from,to);
  const rows=await prisma.cashTransaction.findMany({where:{occurredAt:{gte:start,lte:end}},include:{category:true,paymentMethod:true,event:true},orderBy:{occurredAt:"asc"}});
  return rows.map(r=>({data:brDate(r.occurredAt),tipo:r.type,categoria:r.category.name,descricao:r.description,evento:r.event?.name??"",forma:r.paymentMethod?.name??"",valor:Number(r.amount)}));
}
export async function exportStock(){
  const rows=await getStockReport(); return rows.map(r=>({produto:r.name,sku:r.sku??"",categoria:r.category,unidade:r.unit,saldo:r.balance,minimo:r.minimum,consumido:r.consumed,preco:r.salePrice}));
}
export async function exportEvents(){
  const rows=await getEventsReport(); return rows.map(r=>({evento:r.name,data:brDate(r.startsAt),status:r.status,participantes:r.participants,capacidade:r.capacity??"",inscricoes:Number(r.registrationsPaid),comandas:Number(r.orderRevenue),receitas:r.income,despesas:r.expense,resultado:r.result}));
}
export async function exportAttendance(eventId:string){
  const event=await prisma.event.findUniqueOrThrow({where:{id:eventId}});
  const participants=await prisma.eventParticipant.findMany({where:{registration:{eventId}},include:{registration:true,registrationType:true,checkins:{where:{eventId,status:"CHECKED_IN"},orderBy:{checkedInAt:"desc"},take:1}},orderBy:{name:"asc"}});
  return {title:`Lista de presença - ${event.name}`,rows:participants.map(p=>({participante:p.name,tipo:p.registrationType?.name??"",responsavel:p.registration.name,telefone:p.registration.phone??"",status:p.checkins.length?"PRESENTE":"AUSENTE",checkin:p.checkins[0]?.checkedInAt?brDate(p.checkins[0].checkedInAt):""}))};
}
export async function exportOrders(eventId?:string){
  const rows=await prisma.order.findMany({where:eventId?{eventId}:{},include:{event:true,_count:{select:{items:true}}},orderBy:{openedAt:"desc"}});
  return rows.map(r=>({origem:r.event?"EVENTO":"REUNIAO/AVULSA",evento:r.event?.name??"",cliente:r.customerName,telefone:r.customerPhone??"",status:r.status,itens:r._count.items,total:Number(r.totalAmount),abertura:brDate(r.openedAt),fechamento:brDate(r.closedAt),pagamento:brDate(r.paidAt)}));
}
