import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { authRoutes } from "./routes/auth.js";
import { transactionRoutes } from "./routes/transactions.js";
import { payableRoutes, receivableRoutes } from "./routes/bills.js";
import { invoiceRoutes, categoryRoutes, productRoutes, dashboardRoutes, companyRoutes } from "./routes/resources.js";
const app = Fastify({ logger: { level: "info" } });
async function main() {
  await app.register(fastifyCors, { origin: ["http://localhost:5173"], credentials: true });
  await app.register(fastifyJwt, { secret: process.env.JWT_SECRET ?? "fingest-dev-secret" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(dashboardRoutes, { prefix: "/dashboard" });
  await app.register(transactionRoutes, { prefix: "/transactions" });
  await app.register(payableRoutes, { prefix: "/payables" });
  await app.register(receivableRoutes, { prefix: "/receivables" });
  await app.register(invoiceRoutes, { prefix: "/invoices" });
  await app.register(categoryRoutes, { prefix: "/categories" });
  await app.register(productRoutes, { prefix: "/products" });
  await app.register(companyRoutes, { prefix: "/company" });
  app.get("/health", async () => ({ status: "ok" }));
  app.setErrorHandler((error, _req, reply) => { reply.code(error.statusCode ?? 500).send({ error: error.message ?? "Erro interno." }); });
  await app.listen({ port: 3333, host: "0.0.0.0" });
  console.log("FinGest API em http://localhost:3333");
}
main().catch(err => { console.error(err); process.exit(1); });