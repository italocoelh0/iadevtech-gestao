import { z } from "zod";

export const openOrderSchema = z.object({
  eventId: z.string().trim().optional().transform((value) => value || undefined),
  customerName: z.string().trim().min(2, "Informe seu nome.").max(120),
  customerPhone: z.string().trim().min(8, "Informe um telefone válido.").max(30),
});

export const addOrderItemSchema = z.object({
  orderId: z.string().min(1),
  productId: z.string().min(1, "Produto obrigatório."),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero.").max(999),
});

export const publicAddOrderItemSchema = z.object({
  token: z.string().min(20, "Comanda inválida."),
  productId: z.string().min(1, "Produto obrigatório."),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero.").max(50, "Quantidade muito alta."),
});
