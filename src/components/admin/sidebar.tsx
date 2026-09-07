"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  Package,
  Receipt,
  BarChart3,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/membros", label: "Membros", icon: Users },
  { href: "/admin/mensalidades", label: "Mensalidades", icon: Receipt },
  { href: "/admin/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/admin/inscricoes", label: "Inscrições", icon: ClipboardList },
  { href: "/admin/comandas", label: "Comandas", icon: Wallet },
  { href: "/admin/estoque", label: "Estoque", icon: Package },
  { href: "/admin/financeiro", label: "Financeiro", icon: CircleDollarSign },
  { href: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold">Gestão</p>
          <p className="text-xs text-muted-foreground">Painel administrativo</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4 text-xs text-muted-foreground">
        Sistema de gestão
      </div>
    </aside>
  );
}
