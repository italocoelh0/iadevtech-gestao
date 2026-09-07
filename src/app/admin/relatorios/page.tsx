import Link from "next/link";
import { BarChart3, CalendarDays, CircleDollarSign, Package, Receipt, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButtons } from "@/components/admin/export-buttons";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

const reports = [
  { href: "/admin/relatorios/financeiro", title: "Financeiro", description: "Receitas, despesas, resultado, categorias e formas de pagamento.", icon: CircleDollarSign },
  { href: "/admin/relatorios/mensalidades", title: "Mensalidades", description: "Arrecadação, pendências, isenções e inadimplência.", icon: Receipt },
  { href: "/admin/relatorios/estoque", title: "Estoque", description: "Saldo atual, estoque mínimo e produtos mais consumidos.", icon: Package },
  { href: "/admin/relatorios/eventos", title: "Eventos", description: "Participantes, receitas, despesas e resultado por evento.", icon: CalendarDays },
];

export default async function ReportsPage() {
  await requirePermission(PERMISSIONS.REPORTS_VIEW);
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold tracking-tight">Relatórios</h1><p className="text-muted-foreground">Visões consolidadas para acompanhamento e tomada de decisão.</p></div>
    <div className="rounded-xl border bg-card p-4"><p className="mb-3 text-sm font-medium">Exportações diretas</p><div className="flex flex-wrap gap-5"><div><p className="mb-2 text-sm text-muted-foreground">Cadastro de membros</p><ExportButtons baseUrl="/api/export/membros"/></div><div><p className="mb-2 text-sm text-muted-foreground">Todas as comandas</p><ExportButtons baseUrl="/api/export/comandas"/></div></div></div>
    <div className="grid gap-4 md:grid-cols-2">{reports.map((report)=>{const Icon=report.icon;return <Link key={report.href} href={report.href}><Card className="h-full transition-colors hover:bg-muted/40"><CardHeader><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5"/>{report.title}</CardTitle><CardDescription>{report.description}</CardDescription></CardHeader><CardContent><span className="inline-flex items-center text-sm font-medium">Abrir relatório <BarChart3 className="ml-2 h-4 w-4"/></span></CardContent></Card></Link>})}</div>
  </div>;
}
