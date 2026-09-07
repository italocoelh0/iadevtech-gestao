"use server";

import { AuditAction, EventStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { benefitRuleSchema, eventSchema, registrationTypeSchema, slugify, toDateTime } from "@/lib/events/schema";

export type EventActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function eventFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  return {
    name,
    slug: String(formData.get("slug") ?? "") || slugify(name),
    description: String(formData.get("description") ?? ""),
    coverImageUrl: String(formData.get("coverImageUrl") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    location: String(formData.get("location") ?? ""),
    address: String(formData.get("address") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? "").toUpperCase(),
    registrationOpensAt: String(formData.get("registrationOpensAt") ?? ""),
    registrationClosesAt: String(formData.get("registrationClosesAt") ?? ""),
    capacity: String(formData.get("capacity") ?? ""),
    defaultPrice: String(formData.get("defaultPrice") ?? "0"),
    isPublic: checkbox(formData, "isPublic"),
    allowMembers: checkbox(formData, "allowMembers"),
    allowNonMembers: checkbox(formData, "allowNonMembers"),
    allowCompanions: checkbox(formData, "allowCompanions"),
    allowGroupRegistration: checkbox(formData, "allowGroupRegistration"),
    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createEvent(_: EventActionState, formData: FormData): Promise<EventActionState> {
  const session = await requirePermission(PERMISSIONS.EVENTS_CREATE);
  const parsed = eventSchema.safeParse(eventFormData(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const data = parsed.data;
  const duplicate = await prisma.event.findUnique({ where: { slug: data.slug }, select: { id: true } });
  if (duplicate) return { error: "Já existe um evento com este slug." };

  const event = await prisma.event.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      startsAt: new Date(data.startsAt),
      endsAt: toDateTime(data.endsAt),
      location: data.location ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      registrationOpensAt: toDateTime(data.registrationOpensAt),
      registrationClosesAt: toDateTime(data.registrationClosesAt),
      capacity: data.capacity ?? null,
      defaultPrice: data.defaultPrice,
      isPublic: data.isPublic,
      allowMembers: data.allowMembers,
      allowNonMembers: data.allowNonMembers,
      allowCompanions: data.allowCompanions,
      allowGroupRegistration: data.allowGroupRegistration,
      notes: data.notes ?? null,
      status: EventStatus.DRAFT,
    },
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: AuditAction.CREATE,
    entityType: "Event",
    entityId: event.id,
    description: `Evento ${event.name} criado.`,
    newData: event,
  });

  revalidatePath("/admin/eventos");
  revalidatePath("/eventos");
  redirect(`/admin/eventos/${event.id}?created=1`);
}

export async function updateEvent(id: string, _: EventActionState, formData: FormData): Promise<EventActionState> {
  const session = await requirePermission(PERMISSIONS.EVENTS_UPDATE);
  const parsed = eventSchema.safeParse(eventFormData(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const previous = await prisma.event.findUnique({ where: { id } });
  if (!previous) return { error: "Evento não encontrado." };

  const duplicate = await prisma.event.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) return { error: "Já existe outro evento com este slug." };

  const d = parsed.data;
  const event = await prisma.event.update({
    where: { id },
    data: {
      name: d.name,
      slug: d.slug,
      description: d.description ?? null,
      coverImageUrl: d.coverImageUrl ?? null,
      startsAt: new Date(d.startsAt),
      endsAt: toDateTime(d.endsAt),
      location: d.location ?? null,
      address: d.address ?? null,
      city: d.city ?? null,
      state: d.state ?? null,
      registrationOpensAt: toDateTime(d.registrationOpensAt),
      registrationClosesAt: toDateTime(d.registrationClosesAt),
      capacity: d.capacity ?? null,
      defaultPrice: d.defaultPrice,
      isPublic: d.isPublic,
      allowMembers: d.allowMembers,
      allowNonMembers: d.allowNonMembers,
      allowCompanions: d.allowCompanions,
      allowGroupRegistration: d.allowGroupRegistration,
      notes: d.notes ?? null,
    },
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: AuditAction.UPDATE,
    entityType: "Event",
    entityId: event.id,
    description: `Evento ${event.name} atualizado.`,
    oldData: previous,
    newData: event,
  });

  revalidatePath("/admin/eventos");
  revalidatePath(`/admin/eventos/${id}`);
  revalidatePath(`/eventos/${event.slug}`);
  revalidatePath("/eventos");
  redirect(`/admin/eventos/${id}?updated=1`);
}

async function setEventStatus(id: string, status: EventStatus, description: string) {
  const session = await requirePermission(status === EventStatus.CANCELED ? PERMISSIONS.EVENTS_CANCEL : PERMISSIONS.EVENTS_PUBLISH);
  const previous = await prisma.event.findUnique({ where: { id } });
  if (!previous) throw new Error("EVENT_NOT_FOUND");

  const event = await prisma.event.update({ where: { id }, data: { status } });
  await writeAuditLog({
    actorUserId: session.user.id,
    action: status === EventStatus.CANCELED ? AuditAction.CANCEL : AuditAction.UPDATE,
    entityType: "Event",
    entityId: id,
    description,
    oldData: { status: previous.status },
    newData: { status },
  });
  revalidatePath("/admin/eventos");
  revalidatePath(`/admin/eventos/${id}`);
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${event.slug}`);
}

export async function publishEvent(id: string) {
  return setEventStatus(id, EventStatus.PUBLISHED, "Evento publicado.");
}
export async function openRegistrations(id: string) {
  return setEventStatus(id, EventStatus.REGISTRATIONS_OPEN, "Inscrições do evento abertas.");
}
export async function closeRegistrations(id: string) {
  return setEventStatus(id, EventStatus.REGISTRATIONS_CLOSED, "Inscrições do evento encerradas.");
}
export async function startEvent(id: string) {
  return setEventStatus(id, EventStatus.IN_PROGRESS, "Evento iniciado.");
}
export async function finishEvent(id: string) {
  return setEventStatus(id, EventStatus.FINISHED, "Evento finalizado.");
}
export async function cancelEvent(id: string) {
  return setEventStatus(id, EventStatus.CANCELED, "Evento cancelado.");
}

export async function createRegistrationType(eventId: string, _: EventActionState, formData: FormData): Promise<EventActionState> {
  const session = await requirePermission(PERMISSIONS.EVENTS_TYPES);
  const parsed = registrationTypeSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    price: String(formData.get("price") ?? "0"),
    minAge: String(formData.get("minAge") ?? ""),
    maxAge: String(formData.get("maxAge") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  if (parsed.data.minAge != null && parsed.data.maxAge != null && parsed.data.maxAge < parsed.data.minAge) {
    return { error: "A idade máxima não pode ser menor que a idade mínima." };
  }

  const type = await prisma.eventRegistrationType.create({
    data: { eventId, ...parsed.data, description: parsed.data.description ?? null, minAge: parsed.data.minAge ?? null, maxAge: parsed.data.maxAge ?? null },
  });
  await writeAuditLog({
    actorUserId: session.user.id,
    action: AuditAction.CREATE,
    entityType: "EventRegistrationType",
    entityId: type.id,
    description: `Tipo de inscrição ${type.name} criado.`,
    newData: type,
  });
  revalidatePath(`/admin/eventos/${eventId}`);
  return {};
}

export async function toggleRegistrationType(id: string, eventId: string) {
  const session = await requirePermission(PERMISSIONS.EVENTS_TYPES);
  const previous = await prisma.eventRegistrationType.findUnique({ where: { id } });
  if (!previous || previous.eventId !== eventId) throw new Error("REGISTRATION_TYPE_NOT_FOUND");
  const type = await prisma.eventRegistrationType.update({ where: { id }, data: { active: !previous.active } });
  await writeAuditLog({
    actorUserId: session.user.id,
    action: AuditAction.UPDATE,
    entityType: "EventRegistrationType",
    entityId: id,
    description: `Tipo de inscrição ${type.name} ${type.active ? "ativado" : "inativado"}.`,
    oldData: { active: previous.active },
    newData: { active: type.active },
  });
  revalidatePath(`/admin/eventos/${eventId}`);
}


export async function createBenefitRule(eventId: string, _: EventActionState, formData: FormData): Promise<EventActionState> {
  const session = await requirePermission(PERMISSIONS.EVENTS_TYPES);
  const parsed = benefitRuleSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    benefitType: String(formData.get("benefitType") ?? "EXEMPTION"),
    benefitValue: String(formData.get("benefitValue") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  if (parsed.data.benefitType !== "EXEMPTION" && parsed.data.benefitValue == null) return { error: "Informe o valor do benefício." };
  if (parsed.data.benefitType === "PERCENTAGE_DISCOUNT" && (parsed.data.benefitValue ?? 0) > 100) return { error: "O percentual não pode ultrapassar 100%." };
  const rule = await prisma.eventExemptionRule.create({ data: { eventId, name: parsed.data.name, description: parsed.data.description ?? null, criteria: "MANUAL", benefitType: parsed.data.benefitType, benefitValue: parsed.data.benefitType === "EXEMPTION" ? null : parsed.data.benefitValue ?? null } });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.CREATE, entityType: "EventExemptionRule", entityId: rule.id, description: `Regra de benefício ${rule.name} criada.`, newData: rule });
  revalidatePath(`/admin/eventos/${eventId}`);
  return {};
}

export async function toggleBenefitRule(id: string, eventId: string) {
  const session = await requirePermission(PERMISSIONS.EVENTS_TYPES);
  const previous = await prisma.eventExemptionRule.findUnique({ where: { id } });
  if (!previous || previous.eventId !== eventId) throw new Error("BENEFIT_RULE_NOT_FOUND");
  const rule = await prisma.eventExemptionRule.update({ where: { id }, data: { active: !previous.active } });
  await writeAuditLog({ actorUserId: session.user.id, action: AuditAction.UPDATE, entityType: "EventExemptionRule", entityId: id, description: `Regra ${rule.name} ${rule.active ? "ativada" : "inativada"}.`, oldData: { active: previous.active }, newData: { active: rule.active } });
  revalidatePath(`/admin/eventos/${eventId}`);
}
