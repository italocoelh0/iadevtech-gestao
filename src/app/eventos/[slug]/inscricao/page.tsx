import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicRegistrationForm } from "@/components/registrations/public-registration-form";
import { createPublicRegistration } from "./actions";

export default async function RegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await prisma.event.findFirst({
    where: { slug, isPublic: true },
    include: { registrationTypes: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }, exemptionRules: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  if (!event) notFound();
  const now = new Date();
  const open = event.status === "REGISTRATIONS_OPEN" && (!event.registrationOpensAt || now >= event.registrationOpensAt) && (!event.registrationClosesAt || now <= event.registrationClosesAt);
  if (!open) return <main className="mx-auto max-w-2xl p-6 md:p-10"><Card><CardHeader><CardTitle>Inscrições indisponíveis</CardTitle></CardHeader><CardContent>As inscrições para este evento não estão abertas neste momento.</CardContent></Card></main>;
  const action = createPublicRegistration.bind(null, event.id, event.slug);
  return <main className="min-h-screen bg-muted/30 p-4 py-8 md:p-8"><Card className="mx-auto max-w-3xl"><CardHeader><CardTitle>Inscrição — {event.name}</CardTitle></CardHeader><CardContent><PublicRegistrationForm action={action} allowGroup={event.allowGroupRegistration} types={event.registrationTypes.map(t=>({id:t.id,name:t.name,price:t.price.toString()}))} benefits={event.exemptionRules.map(r=>({id:r.id,name:r.name,description:r.description}))}/></CardContent></Card></main>;
}
