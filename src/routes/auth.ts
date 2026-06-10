import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { RegisterSchema, LoginSchema, RefreshSchema } from "../schemas/index.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    const result = RegisterSchema.safeParse(req.body);
    if (!result.success) return reply.code(400).send({ error: "Dados invalidos", details: result.error.flatten() });
    const { name, email, password, razaoSocial, cnpj, regime } = result.data;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return reply.code(409).send({ error: "E-mail ja cadastrado." });
    const existingCnpj = await prisma.company.findUnique({ where: { cnpj } });
    if (existingCnpj) return reply.code(409).send({ error: "CNPJ ja cadastrado." });
    const passwordHash = await bcrypt.hash(password, 12);
    const company = await prisma.company.create({ data: { razaoSocial, cnpj, regime, email } });
    const user = await prisma.user.create({ data: { name, email, passwordHash, companyId: company.id } });
    await prisma.category.createMany({ data: [
      { companyId: company.id, name: "Servicos", type: "RECEITA", color: "#1D9E75" },
      { companyId: company.id, name: "Produtos", type: "RECEITA", color: "#378ADD" },
      { companyId: company.id, name: "Infraestrutura", type: "DESPESA", color: "#F09595" },
      { companyId: company.id, name: "Tecnologia", type: "DESPESA", color: "#534AB7" },
      { companyId: company.id, name: "Pessoal", type: "DESPESA", color: "#EF9F27" },
      { companyId: company.id, name: "Marketing", type: "DESPESA", color: "#D4537E" },
      { companyId: company.id, name: "Outros", type: "DESPESA", color: "#888780" },
    ]});
    const accessToken = app.jwt.sign({ sub: user.id, companyId: company.id, role: user.role }, { expiresIn: "15m" });
    const refreshToken = app.jwt.sign({ sub: user.id, type: "refresh" }, { expiresIn: "7d" });
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000) } });
    return reply.code(201).send({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role }, company: { id: company.id, razaoSocial: company.razaoSocial, cnpj: company.cnpj } });
  });

  app.post("/login", async (req, reply) => {
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) return reply.code(400).send({ error: "Dados invalidos" });
    const { email, password } = result.data;
    const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return reply.code(401).send({ error: "E-mail ou senha incorretos." });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const accessToken = app.jwt.sign({ sub: user.id, companyId: user.companyId, role: user.role }, { expiresIn: "15m" });
    const refreshToken = app.jwt.sign({ sub: user.id, type: "refresh" }, { expiresIn: "7d" });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000) } });
    return reply.send({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role }, company: { id: user.company.id, razaoSocial: user.company.razaoSocial, cnpj: user.company.cnpj, plan: user.company.plan } });
  });

  app.post("/refresh", async (req, reply) => {
    const result = RefreshSchema.safeParse(req.body);
    if (!result.success) return reply.code(400).send({ error: "Dados invalidos" });
    const { refreshToken } = result.data;
    let payload: any;
    try { payload = app.jwt.verify(refreshToken); } catch { return reply.code(401).send({ error: "Refresh token invalido." }); }
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) return reply.code(401).send({ error: "Refresh token expirado." });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return reply.code(401).send({ error: "Usuario nao encontrado." });
    const newAccessToken = app.jwt.sign({ sub: user.id, companyId: user.companyId, role: user.role }, { expiresIn: "15m" });
    return reply.send({ accessToken: newAccessToken });
  });

  app.post("/logout", { preHandler: [authenticate] }, async (req, reply) => {
    await prisma.refreshToken.deleteMany({ where: { userId: req.user.sub } });
    return reply.send({ message: "Sessao encerrada." });
  });

  app.get("/me", { preHandler: [authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, include: { company: true } });
    if (!user) return reply.code(404).send({ error: "Usuario nao encontrado." });
    const { passwordHash, refreshToken, ...safe } = user as any;
    return reply.send(safe);
  });
}
