import { NextRequest } from "next/server";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { exportAttendance, exportEvents, exportFees, exportFinance, exportMembers, exportOrders, exportStock } from "@/lib/exports/data";
import { exportResponse, toCsv, toPdf, toXlsx, type ExportColumn } from "@/lib/exports";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
const configs: Record<string,{title:string;filename:string;columns:ExportColumn<Row>[]}> = {
  membros:{title:"Membros",filename:"membros",columns:[{key:"nome",label:"Nome",width:28},{key:"telefone",label:"Telefone",width:18},{key:"email",label:"E-mail",width:28},{key:"tipoSanguineo",label:"Tipo sanguíneo",width:14},{key:"nascimento",label:"Nascimento",width:14},{key:"cidade",label:"Cidade",width:20},{key:"uf",label:"UF",width:8},{key:"ingresso",label:"Ingresso",width:14},{key:"status",label:"Status",width:12}]},
  mensalidades:{title:"Mensalidades",filename:"mensalidades",columns:[{key:"membro",label:"Membro",width:28},{key:"competencia",label:"Competência",width:14},{key:"valor",label:"Valor",width:14},{key:"vencimento",label:"Vencimento",width:14},{key:"pagoEm",label:"Pago em",width:14},{key:"status",label:"Status",width:14},{key:"forma",label:"Forma de pagamento",width:20}]},
  financeiro:{title:"Financeiro",filename:"financeiro",columns:[{key:"data",label:"Data",width:14},{key:"tipo",label:"Tipo",width:12},{key:"categoria",label:"Categoria",width:20},{key:"descricao",label:"Descrição",width:34},{key:"evento",label:"Evento",width:24},{key:"forma",label:"Forma de pagamento",width:20},{key:"valor",label:"Valor",width:14}]},
  estoque:{title:"Estoque",filename:"estoque",columns:[{key:"produto",label:"Produto",width:28},{key:"sku",label:"SKU",width:14},{key:"categoria",label:"Categoria",width:18},{key:"unidade",label:"Unidade",width:10},{key:"saldo",label:"Saldo",width:12},{key:"minimo",label:"Mínimo",width:12},{key:"consumido",label:"Consumido",width:14},{key:"preco",label:"Preço",width:14}]},
  eventos:{title:"Eventos",filename:"eventos",columns:[{key:"evento",label:"Evento",width:30},{key:"data",label:"Data",width:14},{key:"status",label:"Status",width:16},{key:"participantes",label:"Participantes",width:14},{key:"capacidade",label:"Capacidade",width:12},{key:"inscricoes",label:"Receita inscrições",width:17},{key:"comandas",label:"Receita comandas",width:17},{key:"receitas",label:"Receitas",width:14},{key:"despesas",label:"Despesas",width:14},{key:"resultado",label:"Resultado",width:14}]},
  comandas:{title:"Comandas",filename:"comandas",columns:[{key:"evento",label:"Evento",width:24},{key:"cliente",label:"Cliente",width:26},{key:"telefone",label:"Telefone",width:16},{key:"status",label:"Status",width:16},{key:"itens",label:"Itens",width:10},{key:"total",label:"Total",width:14},{key:"abertura",label:"Abertura",width:16},{key:"fechamento",label:"Fechamento",width:16},{key:"pagamento",label:"Pagamento",width:16}]},
  presenca:{title:"Lista de presença",filename:"lista-presenca",columns:[{key:"participante",label:"Participante",width:28},{key:"tipo",label:"Tipo",width:18},{key:"responsavel",label:"Responsável",width:26},{key:"telefone",label:"Telefone",width:16},{key:"status",label:"Presença",width:12},{key:"checkin",label:"Check-in",width:16}]},
};

export async function GET(req:NextRequest,{params}:{params:Promise<{report:string}>}){
  try { await requirePermission(PERMISSIONS.REPORTS_VIEW); } catch { return new Response("Acesso negado",{status:403}); }
  const {report}=await params; const format=req.nextUrl.searchParams.get("format")??"xlsx"; if(!["xlsx","csv","pdf"].includes(format)) return new Response("Formato inválido",{status:400});
  let rows:Row[]=[]; let config=configs[report];
  if(!config) return new Response("Relatório inválido",{status:404});
  if(report==="membros") rows=await exportMembers();
  if(report==="mensalidades") rows=await exportFees(Number(req.nextUrl.searchParams.get("year"))||undefined,Number(req.nextUrl.searchParams.get("month"))||undefined);
  if(report==="financeiro") rows=await exportFinance(req.nextUrl.searchParams.get("from")??undefined,req.nextUrl.searchParams.get("to")??undefined);
  if(report==="estoque") rows=await exportStock();
  if(report==="eventos") rows=await exportEvents();
  if(report==="comandas") rows=await exportOrders(req.nextUrl.searchParams.get("eventId")??undefined);
  if(report==="presenca") { const eventId=req.nextUrl.searchParams.get("eventId"); if(!eventId) return new Response("eventId obrigatório",{status:400}); const result=await exportAttendance(eventId); rows=result.rows; config={...config,title:result.title,filename:`presenca-${eventId}`}; }
  if(format==="csv") return exportResponse(toCsv(rows,config.columns),format,config.filename);
  if(format==="pdf") return exportResponse(await toPdf(config.title,rows,config.columns),format,config.filename);
  return exportResponse(await toXlsx(config.title,rows,config.columns),format,config.filename);
}
