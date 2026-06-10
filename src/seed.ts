import bcrypt from "bcryptjs";
import { prisma } from "./utils/prisma.js";

async function main() {
  console.log("Iniciando seed...");
  await prisma.transaction.deleteMany();
  await prisma.payable.deleteMany();
  await prisma.receivable.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.category.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({ data: { razaoSocial: "FinGest Demo Ltda", cnpj: "12.345.678/0001-90", regime: "SIMPLES_NACIONAL", email: "contato@fingestdemo.com.br", plan: "PRO" } });
  const passwordHash = await bcrypt.hash("senha123", 12);
  await prisma.user.create({ data: { companyId: company.id, name: "Joao Silva", email: "joao@fingest.com.br", passwordHash, role: "ADMIN" } });

  const cats = await prisma.$transaction([
    prisma.category.create({ data: { companyId: company.id, name: "Servicos", type: "RECEITA", color: "#1D9E75" } }),
    prisma.category.create({ data: { companyId: company.id, name: "Infraestrutura", type: "DESPESA", color: "#F09595" } }),
    prisma.category.create({ data: { companyId: company.id, name: "Tecnologia", type: "DESPESA", color: "#534AB7" } }),
  ]);

  await prisma.transaction.createMany({ data: [
    { companyId: company.id, type: "RECEITA", description: "Consultoria - Cliente Alfa", amount: 8500, date: new Date("2026-06-05"), status: "PAGO", categoryId: cats[0].id },
    { companyId: company.id, type: "DESPESA", description: "Aluguel escritorio Jun/2026", amount: 3200, date: new Date("2026-06-01"), status: "PAGO", categoryId: cats[1].id },
    { companyId: company.id, type: "RECEITA", description: "Projeto Beta - entrega", amount: 5000, date: new Date("2026-06-08"), status: "PAGO", categoryId: cats[0].id },
    { companyId: company.id, type: "DESPESA", description: "Assinatura ferramentas SaaS", amount: 890, date: new Date("2026-06-02"), status: "PAGO", categoryId: cats[2].id },
    { companyId: company.id, type: "RECEITA", description: "Suporte mensal - Cliente Gama", amount: 2200, date: new Date("2026-06-10"), status: "PENDENTE", categoryId: cats[0].id },
  ]});
  await prisma.payable.createMany({ data: [
    { companyId: company.id, description: "Fornecedor Gama", amount: 1400, dueDate: new Date("2026-06-10"), status: "VENCIDO" },
    { companyId: company.id, description: "Energia eletrica", amount: 430, dueDate: new Date("2026-06-18"), status: "PENDENTE" },
    { companyId: company.id, description: "Internet/Telefone", amount: 380, dueDate: new Date("2026-06-25"), status: "PENDENTE" },
  ]});
  await prisma.receivable.createMany({ data: [
    { companyId: company.id, description: "Cliente Alfa Ltda", amount: 8500, dueDate: new Date("2026-06-15"), status: "PENDENTE", customer: "Alfa Ltda" },
    { companyId: company.id, description: "Beta ME", amount: 3200, dueDate: new Date("2026-06-20"), status: "PENDENTE", customer: "Beta ME" },
    { companyId: company.id, description: "Gama S.A.", amount: 10400, dueDate: new Date("2026-06-30"), status: "PENDENTE", customer: "Gama S.A." },
  ]});
  await prisma.invoice.createMany({ data: [
    { companyId: company.id, number: 1234, tomadorName: "Alfa Ltda", value: 8500, issueDate: new Date("2026-06-09"), status: "AUTORIZADA" },
    { companyId: company.id, number: 1233, tomadorName: "Beta ME", value: 5000, issueDate: new Date("2026-06-08"), status: "AUTORIZADA" },
    { companyId: company.id, number: 1232, tomadorName: "Gama S.A.", value: 12400, issueDate: new Date("2026-06-05"), status: "AGUARDANDO" },
  ]});
  console.log("Seed concluido! Login: joao@fingest.com.br / senha123");
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
