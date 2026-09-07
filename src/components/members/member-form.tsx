"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { MemberActionState } from "@/app/admin/membros/actions";

type BloodTypeValue = "A_POSITIVE" | "A_NEGATIVE" | "B_POSITIVE" | "B_NEGATIVE" | "AB_POSITIVE" | "AB_NEGATIVE" | "O_POSITIVE" | "O_NEGATIVE" | "NOT_INFORMED";
type MemberStatusValue = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DECEASED";

const bloodTypes: Array<[BloodTypeValue, string]> = [
  ["A_POSITIVE", "A+"], ["A_NEGATIVE", "A-"], ["B_POSITIVE", "B+"], ["B_NEGATIVE", "B-"],
  ["AB_POSITIVE", "AB+"], ["AB_NEGATIVE", "AB-"], ["O_POSITIVE", "O+"], ["O_NEGATIVE", "O-"],
  ["NOT_INFORMED", "Não informado"],
];

const statuses: Array<[MemberStatusValue, string]> = [
  ["ACTIVE", "Ativo"], ["INACTIVE", "Inativo"], ["SUSPENDED", "Suspenso"], ["DECEASED", "Falecido"],
];

type InitialValues = {
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  bloodType?: BloodTypeValue;
  birthDate?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  joinedAt?: string;
  status?: MemberStatusValue;
  notes?: string | null;
};

export function MemberForm({
  action,
  initialValues = {},
  submitLabel,
}: {
  action: (state: MemberActionState, formData: FormData) => Promise<MemberActionState>;
  initialValues?: InitialValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  const inputClass = "mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm font-medium";

  return (
    <form action={formAction} className="space-y-6">
      {state.error && <div className="rounded-md border p-3 text-sm">{state.error}</div>}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className={labelClass}>Nome completo *</span>
          <input name="fullName" defaultValue={initialValues.fullName ?? ""} className={inputClass} required />
          {fieldError("fullName") && <p className="mt-1 text-xs text-red-600">{fieldError("fullName")}</p>}
        </label>

        <label>
          <span className={labelClass}>Telefone</span>
          <input name="phone" defaultValue={initialValues.phone ?? ""} className={inputClass} placeholder="(67) 99999-9999" />
        </label>

        <label>
          <span className={labelClass}>E-mail</span>
          <input name="email" type="email" defaultValue={initialValues.email ?? ""} className={inputClass} />
          {fieldError("email") && <p className="mt-1 text-xs text-red-600">{fieldError("email")}</p>}
        </label>

        <label>
          <span className={labelClass}>Tipo sanguíneo</span>
          <select name="bloodType" defaultValue={initialValues.bloodType ?? "NOT_INFORMED"} className={inputClass}>
            {bloodTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label>
          <span className={labelClass}>Data de nascimento</span>
          <input name="birthDate" type="date" defaultValue={initialValues.birthDate ?? ""} className={inputClass} />
        </label>

        <label className="md:col-span-2">
          <span className={labelClass}>Endereço</span>
          <input name="address" defaultValue={initialValues.address ?? ""} className={inputClass} />
        </label>

        <label>
          <span className={labelClass}>Cidade</span>
          <input name="city" defaultValue={initialValues.city ?? ""} className={inputClass} />
        </label>

        <label>
          <span className={labelClass}>Estado</span>
          <input name="state" maxLength={2} defaultValue={initialValues.state ?? ""} className={inputClass} placeholder="MS" />
        </label>

        <label>
          <span className={labelClass}>Data de entrada</span>
          <input name="joinedAt" type="date" defaultValue={initialValues.joinedAt ?? ""} className={inputClass} />
        </label>

        <label>
          <span className={labelClass}>Status</span>
          <select name="status" defaultValue={initialValues.status ?? "ACTIVE"} className={inputClass}>
            {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label className="md:col-span-2">
          <span className={labelClass}>Observações</span>
          <textarea name="notes" defaultValue={initialValues.notes ?? ""} className="mt-1 min-h-28 w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </label>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : submitLabel}</Button>
      </div>
    </form>
  );
}
