import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ExportColumn<T> = { key: keyof T & string; label: string; width?: number };

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
  return String(value);
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: ExportColumn<T>[]) {
  const esc = (value: unknown) => `"${cellText(value).replaceAll('"', '""')}"`;
  return [columns.map((c) => esc(c.label)).join(";"), ...rows.map((row) => columns.map((c) => esc(row[c.key])).join(";"))].join("\r\n");
}

export async function toXlsx<T extends Record<string, unknown>>(title: string, rows: T[], columns: ExportColumn<T>[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de Gestão";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(title.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: c.width ?? 20 }));
  rows.forEach((row) => sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, row[c.key]]))));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  for (const col of columns) {
    const column = sheet.getColumn(col.key);
    if (/valor|total|receita|despesa|saldo|preço|preco/i.test(col.label)) column.numFmt = 'R$ #,##0.00';
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function wrap(text: string, width = 88) {
  const words = text.split(/\s+/); const lines: string[] = []; let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width) { if (current) lines.push(current); current = word; }
    else current = (current + " " + word).trim();
  }
  if (current) lines.push(current); return lines;
}

export async function toPdf<T extends Record<string, unknown>>(title: string, rows: T[], columns: ExportColumn<T>[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [842, 595];
  let page = pdf.addPage(pageSize); let y = 565;
  const drawHeader = () => {
    page.drawText(title, { x: 28, y, size: 16, font: bold, color: rgb(0.08,0.12,0.2) }); y -= 22;
    page.drawText(`Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}`, { x: 28, y, size: 8, font }); y -= 18;
    const widths = columns.map(c => c.width ?? 20); const total = widths.reduce((a,b)=>a+b,0); let x=28;
    for (let i=0;i<columns.length;i++) { const w=(widths[i]/total)*786; page.drawText(columns[i].label.slice(0,24), {x,y,size:7,font:bold}); x+=w; }
    y-=14; page.drawLine({start:{x:28,y:y+5},end:{x:814,y:y+5},thickness:.5,color:rgb(.75,.75,.75)});
  };
  drawHeader();
  const widths = columns.map(c => c.width ?? 20); const total=widths.reduce((a,b)=>a+b,0);
  for (const row of rows) {
    if (y < 35) { page=pdf.addPage(pageSize); y=565; drawHeader(); }
    let x=28; let rowLines=1;
    const vals=columns.map(c=>wrap(cellText(row[c.key]), Math.max(8, Math.floor((c.width??20)*1.7))));
    rowLines=Math.max(...vals.map(v=>v.length));
    for (let i=0;i<columns.length;i++) { const w=(widths[i]/total)*786; const lines=vals[i].slice(0,3); lines.forEach((line,li)=>page.drawText(line,{x,y: y-li*9,size:6.5,font,maxWidth:w-4})); x+=w; }
    y-=Math.max(13,rowLines*9+3);
  }
  return Buffer.from(await pdf.save());
}

export function exportResponse(buffer: Buffer | string, format: string, filename: string) {
  const types: Record<string,string> = { csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" };
  const body = typeof buffer === "string" ? `\uFEFF${buffer}` : buffer;
  return new Response(body, { headers: { "Content-Type": types[format] ?? "application/octet-stream", "Content-Disposition": `attachment; filename=\"${filename}.${format}\"`, "Cache-Control": "no-store" } });
}
