"use server";

import { AuditAction, MemberStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { memberSchema, parseOptionalDate } from "@/lib/members/schema";

export type MemberActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function formToObject(formData: FormData) {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    bloodType: String(formData.get("bloodType") ?? "NOT_INFORMED"),
    birthDate: String(formData.get("birthDate") ?? ""),
    address: String(formData.get("address") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    joinedAt: String(formData.get("joinedAt") ?? ""),
    status: String(formData.get("status") ?? "ACTIVE"),
    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createMember(_: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const session = await requirePermission(PERMISSIONS.MEMBERS_CREATE);
  const parsed = memberSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const data = parsed.data;
  const member = await prisma.member.create({
    data: {
      fullName: data.fullName,
      phone: data.phone ?? null,
      email: data.email?.toLowerCase() ?? null,
      bloodType: data.bloodType,
      birthDate: parseOptionalDate(data.birthDate),
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state || null,
      joinedAt: parseOptionalDate(data.joinedAt),
      status: data.status,
      notes: data.notes ?? null,
    },
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: AuditAction.CREATE,
    entityType: "Member",
    entityId: member.id,
    description: `Membro ${member.fullName} cadastrado.`,
    newData: member,
  });

  revalidatePath("/admin/membros");
  redirect(`/admin/membros/${member.id}?created=1`);
}

export async function updateMember(id: string, _: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const session = await requirePermission(PERMISSIONS.MEMBERS_UPDATE);
  const parsed = memberSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const previous = await prisma.member.findUnique({ where: { id } });
  if (!previous) return { error: "Membro não encontrado." };

  const data = parsed.data;
  const member = await prisma.member.update({
    where: { id },
    data: {
      fullName: data.fullName,
      phone: data.phone ?? null,
      email: data.email?.toLowerCase() ?? null,
      bloodType: data.bloodType,
      birthDate: parseOptionalDate(data.birthDate),
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state || null,
      joinedAt: parseOptionalDate(data.joinedAt),
      status: data.status,
      notes: data.notes ?? null,
    },
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: AuditAction.UPDATE,
    entityType: "Member",
    entityId: member.id,
    description: `Cadastro de ${member.fullName} atualizado.`,
    oldData: previous,
    newData: member,
  });

  revalidatePath("/admin/membros");
  revalidatePath(`/admin/membros/${id}`);
  redirect(`/admin/membros/${id}?updated=1`);
}

export async function toggleMemberStatus(id: string) {
  const session = await requirePermission(PERMISSIONS.MEMBERS_STATUS);
  const previous = await prisma.member.findUnique({ where: { id } });
  if (!previous) throw new Error("MEMBER_NOT_FOUND");

  const nextStatus = previous.status === MemberStatus.ACTIVE ? MemberStatus.INACTIVE : MemberStatus.ACTIVE;
  const member = await prisma.member.update({ where: { id }, data: { status: nextStatus } });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: AuditAction.UPDATE,
    entityType: "Member",
    entityId: member.id,
    description: `Status de ${member.fullName} alterado para ${nextStatus}.`,
    oldData: { status: previous.status },
    newData: { status: nextStatus },
  });

  revalidatePath("/admin/membros");
  revalidatePath(`/admin/membros/${id}`);
}
