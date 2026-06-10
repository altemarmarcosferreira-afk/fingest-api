import type { FastifyInstance } from "fastify";
import { prisma } from "../utils/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { TransactionCreateSchema, TransactionUpdateSchema, TransactionFilterSchema } from "../schemas/index.js";

export async function transactionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/", async (req, reply) => {
    const query = TransactionFilterSchema.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: "Parametros invalidos" });
    const { type, status, categoryId, dateFrom, dateTo, page, limit } = query.data;
    const skip = (page - 1) * limit;
    const where: any = { companyId: req.user.companyId };
    if (type) where.type = type;
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (dateFrom || dateTo) where.date = { ...(dateFrom && { gte: new Date(dateFrom) }), ...(dateTo && { lte: new Date(dateTo) }) };
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ where, include: { category: true }, orderBy: { date: "desc" }, skip, take: limit }),
      prisma.transaction.count({ where }),
    ]);
    return reply.send({ data: transactions, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  });

  app.get("/summary", async (req, reply) => {
    const { companyId } = req.user;
    const now = new Date(); const som = new Date(now.getFullYear(), now.getMonth(), 1); const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const [rec, dep] = await Promise.all([
      prisma.transaction.aggregate({ where: { companyId, type: "RECEITA", status: "PAGO", date: { gte: som, lte: eom } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { companyId, type: "DESPESA", status: "PAGO", date: { gte: som, lte: eom } }, _sum: { amount: true } }),
    ]);
    const r = Number(rec._sum.amount ?? 0); const d = Number(dep._sum.amount ?? 0);
    return reply.send({ receitas: r, despesas: d, saldo: r - d, margem: r > 0 ? ((r - d) / r * 100).toFixed(2) : "0" });
  });

  app.post("/", async (req, reply) => {
    const result = TransactionCreateSchema.safeParse(req.body);
    if (!result.success) return reply.code(400).send({ error: "Dados invalidos", details: result.error.flatten() });
    const { type, description, amount, date, status, categoryId, notes } = result.data;
    const tx = await prisma.transaction.create({ data: { companyId: req.user.companyId, type, description, amount, date: new Date(date), status, categoryId, notes }, include: { category: true } });
    return reply.code(201).send(tx);
  });

  app.patch("/:id", async (req: any, reply) => {
    const exists = await prisma.transaction.findFirst({ where: { id: req.params.id, companyId: req.user.companyId } });
    if (!exists) return reply.code(404).send({ error: "Transacao nao encontrada." });
    const result = TransactionUpdateSchema.safeParse(req.body);
    if (!result.success) return reply.code(400).send({ error: "Dados invalidos" });
    const updated = await prisma.transaction.update({ where: { id: req.params.id }, data: { ...result.data, ...(result.data.date && { date: new Date(result.data.date) }) }, include: { category: true } });
    return reply.send(updated);
  });

  app.delete("/:id", async (req: any, reply) => {
    const exists = await prisma.transaction.findFirst({ where: { id: req.params.id, companyId: req.user.companyId } });
    if (!exists) return reply.code(404).send({ error: "Transacao nao encontrada." });
    await prisma.transaction.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}
