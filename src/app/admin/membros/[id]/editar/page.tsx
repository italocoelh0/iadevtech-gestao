import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MemberForm } from "@/components/members/member-form";
import { updateMember } from "@/app/admin/membros/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

function isoDate(value: Date | null) { return value ? value.toISOString().slice(0, 10) : ""; }

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.MEMBERS_UPDATE);
  const { id } = await params;
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) notFound();
  const action = updateMember.bind(null, member.id);

  return <div className="mx-auto max-w-4xl space-y-6">
    <div><Link href={`/admin/membros/${member.id}`} className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link><h1 className="text-2xl font-bold">Editar membro</h1><p className="text-muted-foreground">{member.fullName}</p></div>
    <Card><CardHeader><CardTitle>Dados do membro</CardTitle></CardHeader><CardContent><MemberForm action={action} submitLabel="Salvar alterações" initialValues={{ ...member, birthDate: isoDate(member.birthDate), joinedAt: isoDate(member.joinedAt) }} /></CardContent></Card>
  </div>;
}
