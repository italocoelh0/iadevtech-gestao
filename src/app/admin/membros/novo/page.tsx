import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MemberForm } from "@/components/members/member-form";
import { createMember } from "@/app/admin/membros/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function NewMemberPage() {
  await requirePermission(PERMISSIONS.MEMBERS_CREATE);
  return <div className="mx-auto max-w-4xl space-y-6">
    <div><Link href="/admin/membros" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link><h1 className="text-2xl font-bold">Novo membro</h1><p className="text-muted-foreground">Cadastre os dados principais do membro.</p></div>
    <Card><CardHeader><CardTitle>Dados do membro</CardTitle></CardHeader><CardContent><MemberForm action={createMember} submitLabel="Cadastrar membro" /></CardContent></Card>
  </div>;
}
