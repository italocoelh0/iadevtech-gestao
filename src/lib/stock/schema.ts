import { z } from "zod";

const decimalString = z.string().trim().min(1).transform((v, ctx) => {
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) { ctx.addIssue({ code: "custom", message: "Informe um valor válido." }); return z.NEVER; }
  return n;
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  sku: z.string().trim().max(80).optional(),
  categoryId: z.string().trim().optional(),
  unit: z.string().trim().min(1).max(12),
  salePrice: decimalString,
  costPrice: z.string().trim().transform((v, ctx) => { if (!v) return undefined; const n=Number(v.replace(",",".")); if(!Number.isFinite(n)||n<0){ctx.addIssue({code:"custom",message:"Valor inválido."});return z.NEVER;} return n; }),
  minimumStock: decimalString,
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da categoria."),
  description: z.string().trim().max(300).optional(),
});

export const movementSchema = z.object({
  productId: z.string().min(1),
  eventId: z.string().trim().optional(),
  type: z.enum(["PURCHASE","DONATION","RETURN","LOSS","DAMAGE","INTERNAL_USE","ADJUSTMENT_IN","ADJUSTMENT_OUT","EVENT_TRANSFER","EVENT_RETURN"]),
  quantity: z.string().trim().min(1).transform((v,ctx)=>{ const n=Number(v.replace(",",".")); if(!Number.isFinite(n)||n<=0){ctx.addIssue({code:"custom",message:"A quantidade deve ser maior que zero."});return z.NEVER;} return n; }),
  unitCost: z.string().trim().transform((v,ctx)=>{ if(!v)return undefined; const n=Number(v.replace(",",".")); if(!Number.isFinite(n)||n<0){ctx.addIssue({code:"custom",message:"Custo inválido."});return z.NEVER;} return n; }),
  notes: z.string().trim().max(500).optional(),
});
