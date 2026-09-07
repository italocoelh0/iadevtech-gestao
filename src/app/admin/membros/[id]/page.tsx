import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toggleMemberStatus } from "@/app/admin/membros/actions";

const labels: Record<string, string> = { ACTIVE: "Ativo", INACTIVE: "Inativo", SUSPENDED: "Suspenso", DECEASED: "Falecido" };
function date(value: Date | null) { return value ? new Intl.DateTimeFormat("pt-BR").format(value) : "—"; }

export default async function MemberDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission(PERMISSIONS.MEMBERS_VIEW);
  const { id } = await params;
  const member = await prisma.member.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, status: true } }, _count: { select: { membershipFees: true, responsibleFor: true } } } });
  if (!member) notFound();
  const toggleAction = toggleMemberStatus.bind(null, member.id);
  const canEdit = hasPermission(session.user.roles, PERMISSIONS.MEMBERS_UPDATE);
  const canChangeStatus = hasPermission(session.user.roles, PERMISSIONS.MEMBERS_STATUS);

  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><Link href="/admin/membros" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link><div className="flex items-center gap-3"><h1 className="text-2xl font-bold">{member.fullName}</h1><Badge>{labels[member.status]}</Badge></div><p className="text-muted-foreground">Cadastro do membro</p></div>
      <div className="flex gap-2">{canChangeStatus && <form action={toggleAction}><Button type="submit" variant="outline">{member.status === "ACTIVE" ? "Inativar" : "Ativar"}</Button></form>}{canEdit && <Link href={`/admin/membros/${member.id}/editar`}><Button><Pencil className="mr-2 h-4 w-4" />Editar</Button></Link>}</div>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Card><CardHeader><CardTitle>Dados pessoais</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Item label="Telefone" value={member.phone}/><Item label="E-mail" value={member.email}/><Item label="Nascimento" value={date(member.birthDate)}/><Item label="Tipo sanguíneo" value={member.bloodType.replace("_POSITIVE", "+").replace("_NEGATIVE", "-").replace("NOT_INFORMED", "—")}/><Item label="Data de entrada" value={date(member.joinedAt)}/><Item label="Cidade/UF" value={[member.city, member.state].filter(Boolean).join(" / ") || "—"}/><div className="sm:col-span-2"><Item label="Endereço" value={member.address}/></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Relacionamentos</CardTitle></CardHeader><CardContent className="space-y-4"><Item label="Usuário do sistema" value={member.user?.email ?? "Não vinculado"}/><div><Item label="Mensalidades registradas" value={String(member._count.membershipFees)}/><Link href={`/admin/mensalidades?q=${encodeURIComponent(member.fullName)}`} className="mt-1 inline-block text-xs font-medium hover:underline">Ver mensalidades</Link></div><Item label="Inscrições como responsável" value={String(member._count.responsibleFor)}/></CardContent></Card>
    </div>
    {member.notes && <Card><CardHeader><CardTitle>Observações</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{member.notes}</p></CardContent></Card>}
  </div>;
}

function Item({ label, value }: { label: string; value?: string | null }) { return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm">{value || "—"}</p></div>; }
