import Link from "next/link";
import { MemberStatus, Prisma } from "@prisma/client";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const statusLabel: Record<MemberStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  SUSPENDED: "Suspenso",
  DECEASED: "Falecido",
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requirePermission(PERMISSIONS.MEMBERS_VIEW);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = Object.values(MemberStatus).includes(params.status as MemberStatus)
    ? (params.status as MemberStatus)
    : undefined;
  const page = Math.max(Number(params.page) || 1, 1);
  const pageSize = 20;

  const where: Prisma.MemberWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
  };

  const [members, total] = await prisma.$transaction([
    prisma.member.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, fullName: true, phone: true, email: true, bloodType: true, status: true, joinedAt: true },
    }),
    prisma.member.count({ where }),
  ]);
  const pages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membros</h1>
          <p className="text-muted-foreground">Cadastros, situação e informações dos membros.</p>
        </div>
        <Link href="/admin/membros/novo"><Button><Plus className="mr-2 h-4 w-4" />Novo membro</Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Pesquisar</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input name="q" defaultValue={q} placeholder="Nome, telefone ou e-mail" className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
            </div>
            <select name="status" defaultValue={status ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">Todos os status</option>
              {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Button type="submit" variant="secondary">Filtrar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{total} membro(s)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/50 text-left"><tr>
                <th className="px-6 py-3 font-medium">Nome</th><th className="px-6 py-3 font-medium">Contato</th>
                <th className="px-6 py-3 font-medium">Tipo sanguíneo</th><th className="px-6 py-3 font-medium">Status</th><th className="px-6 py-3"></th>
              </tr></thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="px-6 py-4 font-medium">{member.fullName}</td>
                    <td className="px-6 py-4 text-muted-foreground"><div>{member.phone || "—"}</div><div>{member.email || "—"}</div></td>
                    <td className="px-6 py-4">{member.bloodType.replace("_POSITIVE", "+").replace("_NEGATIVE", "-").replace("NOT_INFORMED", "—")}</td>
                    <td className="px-6 py-4"><Badge>{statusLabel[member.status]}</Badge></td>
                    <td className="px-6 py-4 text-right"><Link className="font-medium underline-offset-4 hover:underline" href={`/admin/membros/${member.id}`}>Abrir</Link></td>
                  </tr>
                ))}
                {members.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">Nenhum membro encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-6 py-4 text-sm">
            <span className="text-muted-foreground">Página {page} de {pages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`?q=${encodeURIComponent(q)}&status=${status ?? ""}&page=${page - 1}`}><Button variant="outline" size="sm">Anterior</Button></Link>}
              {page < pages && <Link href={`?q=${encodeURIComponent(q)}&status=${status ?? ""}&page=${page + 1}`}><Button variant="outline" size="sm">Próxima</Button></Link>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
