import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { receiptData, receiptPdf } from "@/lib/exports/receipt";
export const dynamic="force-dynamic";
export async function GET(_:Request,{params}:{params:Promise<{kind:string;id:string}>}){
  try { await requirePermission(PERMISSIONS.REPORTS_VIEW); } catch { return new Response("Acesso negado",{status:403}); }
  const {kind,id}=await params; const data=await receiptData(kind,id); if(!data) return new Response("Pagamento não encontrado ou ainda não confirmado",{status:404});
  const pdf=await receiptPdf(data); return new Response(pdf,{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename=\"recibo-${kind}-${id}.pdf\"`,"Cache-Control":"no-store"}});
}
