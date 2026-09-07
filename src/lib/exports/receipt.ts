import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";

const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const date=(d:Date|null|undefined)=>d?new Intl.DateTimeFormat("pt-BR",{dateStyle:"long"}).format(d):"";

export async function receiptData(kind:string,id:string){
  if(kind==="mensalidade") { const r=await prisma.membershipFee.findUnique({where:{id},include:{member:true,paymentMethod:true}}); if(!r||r.status!=="PAID") return null; return {title:"Recibo de mensalidade",payer:r.member.fullName,description:`Mensalidade ${String(r.competencyMonth).padStart(2,"0")}/${r.competencyYear}`,amount:Number(r.amount),paidAt:r.paidAt,method:r.paymentMethod?.name??"Não informada",reference:r.id}; }
  if(kind==="inscricao") { const r=await prisma.eventRegistration.findUnique({where:{id},include:{event:true}}); if(!r||r.status!=="PAID") return null; return {title:"Recibo de inscrição",payer:r.name,description:`Inscrição - ${r.event.name}`,amount:Number(r.finalAmount),paidAt:r.confirmedAt??r.updatedAt,method:"PIX",reference:r.id}; }
  if(kind==="comanda") { const r=await prisma.order.findUnique({where:{id},include:{event:true,paymentMethod:true}}); if(!r||r.status!=="PAID") return null; return {title:"Recibo de comanda",payer:r.customerName,description:`Comanda${r.event?` - ${r.event.name}`:""}`,amount:Number(r.totalAmount),paidAt:r.paidAt,method:r.paymentMethod?.name??"PIX",reference:r.id}; }
  return null;
}

export async function receiptPdf(data:NonNullable<Awaited<ReturnType<typeof receiptData>>>) {
  const pdf=await PDFDocument.create(); const page=pdf.addPage([420,595]); const font=await pdf.embedFont(StandardFonts.Helvetica); const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText(data.title,{x:36,y:535,size:18,font:bold,color:rgb(.08,.12,.2)});
  page.drawText(`Recebemos de: ${data.payer}`,{x:36,y:490,size:11,font});
  page.drawText(`Referente a: ${data.description}`,{x:36,y:465,size:11,font});
  page.drawText(`Valor: ${money(data.amount)}`,{x:36,y:430,size:15,font:bold});
  page.drawText(`Forma de pagamento: ${data.method}`,{x:36,y:400,size:10,font});
  page.drawText(`Data do pagamento: ${date(data.paidAt)}`,{x:36,y:380,size:10,font});
  page.drawText(`Referência: ${data.reference}`,{x:36,y:350,size:8,font,color:rgb(.35,.35,.35)});
  page.drawLine({start:{x:36,y:315},end:{x:384,y:315},thickness:.6,color:rgb(.75,.75,.75)});
  page.drawText("Documento gerado pelo sistema de gestão.",{x:36,y:290,size:8,font,color:rgb(.4,.4,.4)});
  return Buffer.from(await pdf.save());
}
