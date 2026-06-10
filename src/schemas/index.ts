import { z } from "zod";
export const RegisterSchema = z.object({
  name: z.string().min(2), email: z.string().email(), password: z.string().min(8),
  razaoSocial: z.string().min(2), cnpj: z.string().min(14), regime: z.string().default("SIMPLES_NACIONAL"),
});
export const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const RefreshSchema = z.object({ refreshToken: z.string().min(1) });
export const TransactionCreateSchema = z.object({
  type: z.enum(["RECEITA","DESPESA"]), description: z.string().min(1),
  amount: z.number().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PAGO","PENDENTE","VENCIDO"]).default("PENDENTE"),
  categoryId: z.string().uuid().optional(), notes: z.string().optional(),
});
export const TransactionUpdateSchema = TransactionCreateSchema.partial();
export const TransactionFilterSchema = z.object({
  type: z.enum(["RECEITA","DESPESA"]).optional(), status: z.enum(["PAGO","PENDENTE","VENCIDO"]).optional(),
  categoryId: z.string().uuid().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const BillSchema = z.object({
  description: z.string().min(1), amount: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplier: z.string().optional(), customer: z.string().optional(), notes: z.string().optional(),
});
export const BillUpdateSchema = BillSchema.partial().extend({ status: z.string().optional(), paidAt: z.string().optional() });
export const InvoiceCreateSchema = z.object({
  tomadorName: z.string().min(1), tomadorCnpj: z.string().optional(),
  value: z.number().positive(), issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const CategorySchema = z.object({ name: z.string().min(1), type: z.enum(["RECEITA","DESPESA"]), color: z.string().default("#1D9E75") });
export const ProductSchema = z.object({ name: z.string().min(1), sku: z.string().optional(), qty: z.number().int().min(0).default(0), minQty: z.number().int().min(0).default(0), unitCost: z.number().min(0).default(0) });
export const CompanyUpdateSchema = z.object({ razaoSocial: z.string().min(2).optional(), email: z.string().email().optional(), phone: z.string().optional(), regime: z.string().optional() });
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type TransactionCreate = z.infer<typeof TransactionCreateSchema>;
export type TransactionFilter = z.infer<typeof TransactionFilterSchema>;
