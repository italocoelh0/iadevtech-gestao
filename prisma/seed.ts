import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roles = [
  { name: "ADMIN", description: "Acesso total ao sistema." },
  { name: "PRESIDENTE", description: "Acesso administrativo e de acompanhamento da organização." },
  { name: "TESOUREIRO", description: "Acesso a mensalidades, caixa, financeiro e relatórios financeiros." },
  { name: "SECRETARIO", description: "Acesso a membros, eventos e rotinas administrativas." },
  { name: "MEMBRO", description: "Acesso limitado às funcionalidades destinadas a membros." },
] as const;

const permissions = [
  { name: "members.view", description: "Visualizar membros." },
  { name: "members.create", description: "Cadastrar membros." },
  { name: "members.update", description: "Editar membros." },
  { name: "members.status", description: "Ativar ou inativar membros." },
  { name: "fees.view", description: "Visualizar mensalidades." },
  { name: "fees.create", description: "Lançar mensalidades manualmente." },
  { name: "fees.generate", description: "Gerar mensalidades em lote e configurar valores padrão." },
  { name: "fees.pay", description: "Registrar pagamento de mensalidades." },
  { name: "fees.exempt", description: "Conceder isenção de mensalidades." },
  { name: "fees.cancel", description: "Cancelar mensalidades e gerar estornos quando necessário." },
  { name: "finance.view", description: "Visualizar financeiro, extrato e caixas." },
  { name: "finance.create", description: "Registrar receitas e despesas." },
  { name: "finance.reverse", description: "Estornar movimentações financeiras." },
  { name: "cash.open", description: "Abrir caixa." },
  { name: "cash.close", description: "Fechar caixa." },
  { name: "finance.settings", description: "Gerenciar categorias e formas de pagamento." },
  { name: "events.view", description: "Visualizar eventos no painel administrativo." },
  { name: "events.create", description: "Cadastrar eventos." },
  { name: "events.update", description: "Editar eventos." },
  { name: "events.publish", description: "Publicar e controlar inscrições de eventos." },
  { name: "events.cancel", description: "Cancelar eventos." },
  { name: "events.types", description: "Gerenciar tipos e valores de inscrição." },
  { name: "registrations.view", description: "Visualizar inscrições e participantes." },
  { name: "registrations.update", description: "Atualizar situação de inscrições." },
  { name: "registrations.benefits", description: "Aprovar ou rejeitar benefícios e isenções." },
  { name: "registrations.payment", description: "Confirmar pagamentos de inscrições." },
  { name: "stock.view", description: "Visualizar produtos, saldos e movimentações de estoque." },
  { name: "stock.products", description: "Cadastrar e editar produtos." },
  { name: "stock.movements", description: "Registrar entradas e saídas de estoque." },
  { name: "stock.adjust", description: "Registrar ajustes de inventário e reversões de estoque." },
  { name: "stock.settings", description: "Gerenciar categorias de produtos." },
  { name: "orders.view", description: "Visualizar comandas." },
  { name: "orders.manage", description: "Adicionar e remover consumos e fechar comandas." },
  { name: "orders.payment", description: "Confirmar pagamento manual de comandas." },
  { name: "orders.cancel", description: "Cancelar comandas abertas ou aguardando pagamento." },
  { name: "reports.view", description: "Visualizar dashboard e relatórios gerenciais consolidados." },
  { name: "events.operation", description: "Visualizar o painel operacional e pendências do evento." },
  { name: "events.checkin", description: "Realizar e reverter check-in de participantes." },
  { name: "events.finish", description: "Finalizar evento após validação das pendências operacionais." },
] as const;

const rolePermissions: Record<string, string[]> = {
  ADMIN: permissions.map((permission) => permission.name),
  PRESIDENTE: permissions.map((permission) => permission.name),
  SECRETARIO: ["members.view", "members.create", "members.update", "fees.view", "events.view", "events.create", "events.update", "events.publish", "events.types", "registrations.view", "registrations.update", "stock.view", "orders.view", "orders.manage", "reports.view", "events.operation", "events.checkin"],
  TESOUREIRO: ["fees.view", "fees.create", "fees.generate", "fees.pay", "fees.exempt", "fees.cancel", "finance.view", "finance.create", "finance.reverse", "cash.open", "cash.close", "finance.settings", "events.view", "registrations.view", "registrations.benefits", "registrations.payment", "stock.view", "stock.products", "stock.movements", "stock.settings", "orders.view", "orders.manage", "orders.payment", "reports.view", "events.operation"],
  MEMBRO: [],
};

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const [roleName, permissionNames] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { name: permissionName } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const paymentMethods = [
    { name: "Dinheiro", type: "CASH" as const },
    { name: "PIX", type: "PIX" as const },
    { name: "Cartão de débito", type: "DEBIT_CARD" as const },
    { name: "Cartão de crédito", type: "CREDIT_CARD" as const },
    { name: "Transferência", type: "BANK_TRANSFER" as const },
    { name: "Outros", type: "OTHER" as const },
  ];
  for (const method of paymentMethods) {
    await prisma.paymentMethod.upsert({ where: { name: method.name }, update: { type: method.type, active: true }, create: method });
  }

  await prisma.cashCategory.upsert({
    where: { name: "Mensalidades" },
    update: { type: "INCOME", active: true, description: "Recebimentos de mensalidades de membros." },
    create: { name: "Mensalidades", type: "INCOME", active: true, description: "Recebimentos de mensalidades de membros." },
  });

  const cashCategories = [
    { name: "Eventos", type: "INCOME" as const, description: "Receitas de inscrições e atividades de eventos." },
    { name: "Bebidas", type: "INCOME" as const, description: "Receitas com bebidas e consumo." },
    { name: "Contas", type: "EXPENSE" as const, description: "Despesas recorrentes e contas." },
    { name: "Manutenção", type: "EXPENSE" as const, description: "Serviços e materiais de manutenção." },
    { name: "Melhorias", type: "EXPENSE" as const, description: "Investimentos e melhorias." },
    { name: "Aquisição de materiais", type: "EXPENSE" as const, description: "Compra de materiais e equipamentos." },
    { name: "Alimentação", type: "EXPENSE" as const, description: "Despesas com alimentação." },
    { name: "Combustível", type: "EXPENSE" as const, description: "Despesas com combustível." },
    { name: "Serviços", type: "EXPENSE" as const, description: "Serviços contratados." },
    { name: "Outros recebimentos", type: "INCOME" as const, description: "Outras receitas." },
    { name: "Outras despesas", type: "EXPENSE" as const, description: "Outras despesas." },
  ];
  for (const category of cashCategories) {
    await prisma.cashCategory.upsert({ where: { name: category.name }, update: { type: category.type, active: true, description: category.description }, create: category });
  }

  await prisma.cashCategory.upsert({
    where: { name: "Comandas" },
    update: { type: "INCOME", active: true, description: "Receitas de comandas de eventos." },
    create: { name: "Comandas", type: "INCOME", active: true, description: "Receitas de comandas de eventos." },
  });


  const productCategories = ["Bebidas", "Alimentos", "Descartáveis", "Materiais", "Outros"] as const;
  for (const name of productCategories) {
    await prisma.productCategory.upsert({
      where: { name },
      update: { active: true },
      create: { name, active: true },
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: "membership_fee.default_amount" }, update: {},
    create: { key: "membership_fee.default_amount", value: "50.00", valueType: "NUMBER", description: "Valor padrão da mensalidade." },
  });
  await prisma.systemSetting.upsert({
    where: { key: "membership_fee.due_day" }, update: {},
    create: { key: "membership_fee.due_day", value: "10", valueType: "NUMBER", description: "Dia padrão de vencimento da mensalidade." },
  });


  await prisma.systemSetting.upsert({
    where: { key: "pix.key" },
    update: { value: "patriotasmcms@gmail.com", valueType: "STRING", isSecret: false },
    create: { key: "pix.key", value: "patriotasmcms@gmail.com", valueType: "STRING", description: "Chave PIX exibida para pagamentos manuais.", isSecret: false },
  });

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrador";

  if (!email || !password) {
    console.log("Roles criadas. ADMIN_EMAIL/ADMIN_PASSWORD não informados; usuário admin não foi criado.");
    return;
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD deve possuir pelo menos 8 caracteres.");
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, status: "ACTIVE" },
    create: { email, name, passwordHash, status: "ACTIVE" },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });

  console.log(`Usuário administrador preparado: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
