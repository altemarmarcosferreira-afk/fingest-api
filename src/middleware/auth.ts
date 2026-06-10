import type { FastifyRequest, FastifyReply } from "fastify";
export interface JWTPayload { sub: string; companyId: string; role: string; }
declare module "fastify" { interface FastifyRequest { user: JWTPayload; } }
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    request.user = request.user as JWTPayload;
  } catch {
    reply.code(401).send({ error: "Token invalido ou expirado." });
  }
}
