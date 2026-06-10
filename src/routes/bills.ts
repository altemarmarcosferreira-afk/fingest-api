import type { FastifyInstance } from "fastify";
import { prisma } from "../utils/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { BillSchema, BillUpdateSchema } from "../schemas/index.js";

function makeBillRoutes(model: "payable" | "receivable") {
  const dal: any = model === "payable" ? prisma.payable : prisma.receivable;
  return async function(app: FastifyInstance) {
    app.addHook("preHandler", authenticate);
    app.get("/", async (req, reply) => {
      const { status } = req.query as any;
      const items = await dal.findMany({ where: { companyId: req.user.companyId, ...(status && { status }) }, orderBy: { dueDate: "asc" } });
      return reply.send(items);
    });
    app.get("/summary", async (req, reply) => {
      const items = await dal.findMany({ where: { companyId: req.user.companyId, status: { not: "PAGO" } } });
      const total = items.reduce((a: number, i: any) => a + Number(i.amount), 0);
      const vencidos = items.filter((i: any) => i.status === "VENCIDO" || new Date(i.dueDate) < new Date()).length;
      return reply.send({ total, count: items.length, vencidos });
    });
    app.post("/", async (req, reply) => {
      const result = BillSchema.safeParse(req.body);
      if (!result.success) return reply.code(400).send({ error: "Dados invalidos", details: result.error.flatten() });
      const item = await dal.create({ data: { companyId: req.user.companyId, ...result.data, dueDate: new Date(result.data.dueDate) } });
      return reply.code(201).send(item);
    });
    app.patch("/:id", async (req: any, reply) => {
      const exists = await dal.findFirst({ where: { id: req.params.id, companyId: req.user.companyId } });
      if (!exists) return reply.code(404).send({ error: "Registro nao encontrado." });
      const result = BillUpdateSchema.safeParse(req.body);
      if (!result.success) return reply.code(400).send({ error: "Dados invalidos" });
      const updated = await dal.update({ where: { id: req.params.id }, data: { ...result.data, ...(result.data.dueDate && { dueDate: new Date(result.data.dueDate) }) } });
      return reply.send(updated);
    });
    app.post("/:id/baixar", async (req: any, reply) => {
      const item = await dal.findFirst({ where: { id: req.params.id, companyId: req.user.companyId } });
      if (!item) return reply.code(404).send({ error: "Registro nao encontrado." });
      if (item.status === "PAGO") return reply.code(409).send({ error: "Titulo ja baixado." });
      await prisma.$transaction([
        dal.update({ where: { id: req.params.id }, data: { status: "PAGO", paidAt: new Date() } }),
        prisma.transaction.create({ data: { companyId: req.user.companyId, type: model === "payable" ? "DESPESA" : "RECEITA", description: item.description, amount: item.amount, date: new Date(), status: "PAGO" } }),
      ]);
      return reply.send({ message: "Titulo baixado e transacao gerada." });
    });
    app.delete("/:id", async (req: any, reply) => {
      const exists = await dal.findFirst({ where: { id: req.params.id, companyId: req.user.companyId } });
      if (!exists) return reply.code(404).send({ error: "Registro nao encontrado." });
      await dal.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    });
  };
}
export const payableRoutes = makeBillRoutes("payable");
export const receivableRoutes = makeBillRoutes("receivable");
