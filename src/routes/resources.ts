import type { FastifyInstance } from "fastify";
import { prisma } from "../utils/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { InvoiceCreateSchema, CategorySchema, ProductSchema, CompanyUpdateSchema } from "../schemas/index.js";

export async function invoiceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.get("/", async (req, reply) => {
    return reply.send(await prisma.invoice.findMany({ where: { companyId: req.user.companyId }, orderBy: { issueDate: "desc" } }));
  });
  app.post("/", async (req, reply) => {
    const result = InvoiceCreateSchema.safeParse(req.body);
    if (!result.success) return reply.code(400).send({ error: "Dados invalidos", details: result.error.flatten() });
    const last = await prisma.invoice.findFirst({ where: { companyId: req.user.companyId }, orderBy: { number: "desc" } });
    const invoice = await prisma.invoice.create({ data: { companyId: req.user.companyId, number: (last?.number ?? 0) + 1, tomadorName: result.data.tomadorName, tomadorCnpj: result.data.tomadorCnpj, value: result.data.value, issueDate: new Date(result.data.issueDate), status: "AGUARDANDO" } });
    return reply.code(201).send(invoice);
  });
  app.patch("/:id/status", async (req: any, reply) => {
    const exists = await prisma.invoice.findFirst({ where: { id: req.params.id, companyId: req.user.companyId } });
    if (!exists) return reply.code(404).send({ error: "Nota nao encontrada." });
    return reply.send(await prisma.invoice.update({ where: { id: req.params.id }, data: { status: req.body.status } }));
  });
}

export async function categoryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.get("/", async (req, reply) => reply.send(await prisma.category.findMany({ where: { companyId: req.user.companyId }, orderBy: [{ type: "asc" }, { name: "asc" }] })));
  app.post("/", async (req, reply) => {
    const result = CategorySchema.safeParse(req.body);
    if (!result.success) return reply.code(400).send({ error: "Dados invalidos" });
    return reply.code(201).send(await prisma.category.create({ data: { companyId: req.user.companyId, ...result.data } }));
  });
  app.delete("/:id", async (req: any, reply) => {
    const exists = await prisma.category.findFirst({ where: { id: req.params.id, companyId: req.user.companyId } });
    if (!exists) return reply.code(404).send({ error: "Categoria nao encontrada." });
    await prisma.category.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}

export async function productRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.get("/", async (req, reply) => reply.send(await prisma.product.findMany({ where: { companyId: req.user.companyId }, orderBy: { name: "asc" } })));
  app.post("/", async (req, reply) => {
    const result = ProductSchema.safeParse(req.body);
    if (!result.success) return reply.code(400).send({ error: "Dados invalidos" });
    return reply.code(201).send(await prisma.product.create({ data: { companyId: req.user.companyId, ...result.data } }));
  });
  app.patch("/:id", async (req: any, reply) => {
    const exists = await prisma.product.findFirst({ where: { id: req.params.id, companyId: req.user.companyId } });
    if (!exists) return reply.code(404).send({ error: "Produto nao encontrado." });
    return reply.send(await prisma.product.update({ where: { id: req.params.id }, data: req.body as any }));
  });
  app.delete("/:id", async (req: any, reply) => {
    const exists = await prisma.product.findFirst({ where: { id: req.params.id, companyId: req.user.companyId } });
    if (!exists) return reply.code(404).send({ error: "Produto nao encontrado." });
    await prisma.product.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.get("/", async (req, reply) => {
    const { companyId } = req.user;
    const now = new Date(); const som = new Date(now.getFullYear(), now.getMonth(), 1); const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const [rec, dep, vencidas, titulos, ultimas, nfPend] = await Promise.all([
      prisma.transaction.aggregate({ where: { companyId, type: "RECEITA", status: "PAGO", date: { gte: som, lte: eom } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { companyId, type: "DESPESA", status: "PAGO", date: { gte: som, lte: eom } }, _sum: { amount: true } }),
      prisma.payable.count({ where: { companyId, status: "VENCIDO" } }),
      prisma.receivable.findMany({ where: { companyId, status: { not: "PAGO" } }, select: { amount: true } }),
      prisma.transaction.findMany({ where: { companyId }, include: { category: true }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.invoice.count({ where: { companyId, status: "AGUARDANDO" } }),
    ]);
    const r = Number(rec._sum.amount ?? 0); const d = Number(dep._sum.amount ?? 0);
    return reply.send({ kpis: { receitas: r, despesas: d, saldo: r - d, aReceber: titulos.reduce((a: number, t: any) => a + Number(t.amount), 0), contasVencidas: vencidas, notasPendentes: nfPend }, ultimasMovimentacoes: ultimas });
  });
}

export async function companyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.get("/", async (req, reply) => reply.send(await prisma.company.findUnique({ where: { id: req.user.companyId } })));
  app.patch("/", async (req, reply) => {
    const result = CompanyUpdateSchema.safeParse(req.body);
    if (!result.success) return reply.code(400).send({ error: "Dados invalidos" });
    return reply.send(await prisma.company.update({ where: { id: req.user.companyId }, data: result.data }));
  });
}
