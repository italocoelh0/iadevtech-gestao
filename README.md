# Gestão de Empresa — Etapa 01

Base inicial do sistema usando:

- Next.js
- TypeScript
- Prisma
- MySQL
- Tailwind/shadcn-ui (a ser configurado na próxima etapa)

## Requisitos

- Node.js 20+
- MySQL 8+ ou compatível
- npm

## Configuração

1. Copie `.env.example` para `.env.local`.
2. Configure `DATABASE_URL` com as credenciais do banco.
3. Instale as dependências:

```bash
npm install
```

4. Gere o client Prisma:

```bash
npx prisma generate
```

5. Valide o schema:

```bash
npx prisma validate
```

6. Em um banco de desenvolvimento, crie a primeira migration:

```bash
npx prisma migrate dev --name init
```

7. Execute o seed:

```bash
npm run prisma:seed
```

8. Inicie:

```bash
npm run dev
```

## Segurança

Nunca coloque credenciais reais do MySQL em arquivos versionados.

Para Vercel, configure `DATABASE_URL` em Project Settings → Environment Variables.

## Domínio funcional

O schema já contempla:

- usuários, roles e permissões;
- membros;
- mensalidades;
- eventos;
- tipos de inscrição;
- regras de isenção/desconto;
- inscrições e participantes;
- pagamentos e check-in;
- produtos e categorias;
- movimentações de estoque;
- caixas e movimentações financeiras;
- comandas e itens;
- auditoria;
- configurações do sistema.

## Observação sobre produção

Antes de conectar este projeto a um banco de produção, revise os índices, políticas de retenção/auditoria, backups e credenciais.

## Etapa 02

Esta etapa adiciona:

- Tailwind CSS;
- base de componentes no padrão shadcn/ui;
- `cn()` para composição de classes;
- layout administrativo responsivo;
- sidebar de navegação;
- header administrativo;
- dashboard inicial;
- rotas-base dos módulos;
- página pública;
- página inicial de login.

A autenticação e a proteção real das rotas ainda serão implementadas na etapa de segurança.

## Etapa 03 — Autenticação e RBAC

A etapa adiciona autenticação com Auth.js/NextAuth usando credenciais e sessão JWT.

### Variáveis adicionais

Configure `AUTH_SECRET`. Para criar o primeiro administrador pelo seed, configure também:

```env
ADMIN_NAME="Administrador"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="uma-senha-forte"
```

Depois execute:

```bash
npm install
npx prisma generate
npm run prisma:seed
npm run dev
```

A área `/admin` fica protegida. Usuários inativos/bloqueados não conseguem autenticar.

### RBAC

A sessão carrega as roles do usuário. A aplicação já possui helpers em `src/lib/auth/permissions.ts` para exigir roles em Server Components, Server Actions e endpoints.

A proteção de granularidade por módulo será aplicada junto às regras de negócio de cada módulo, evitando depender somente da navegação da interface.

### Segurança

- Senhas armazenadas somente como hash bcrypt.
- Sessão via JWT.
- `AUTH_SECRET` fora do código.
- Credenciais administrativas do seed via variáveis de ambiente.
- Rotas administrativas protegidas por middleware e também pelo layout server-side.

## Etapa 04 — Módulo de Membros

Nesta etapa foram adicionados:

- correção da estrutura de rotas para `/admin/*`;
- listagem de membros com busca, filtro por status e paginação;
- cadastro de membro;
- edição de membro;
- página de detalhes;
- ativação/inativação;
- validação com Zod;
- Server Actions;
- persistência com Prisma;
- registro de auditoria para criação, edição e alteração de status;
- permissões de membros no seed;
- componentes reutilizáveis de formulário e badge.

### Permissões iniciais do módulo

- `members.view`: ADMIN, PRESIDENTE, SECRETARIO
- `members.create`: ADMIN, PRESIDENTE, SECRETARIO
- `members.update`: ADMIN, PRESIDENTE, SECRETARIO
- `members.status`: ADMIN, PRESIDENTE

O controle em runtime permanece baseado nas roles presentes na sessão, enquanto as permissões também são persistidas no banco para evolução posterior do RBAC.

## Etapa 05 — Mensalidades

Esta etapa implementa o primeiro fluxo financeiro integrado do domínio:

- listagem de mensalidades por competência;
- pesquisa por membro e filtro por status;
- indicadores de previsto, recebido, pendente, inadimplência e cobertura;
- geração em lote para todos os membros ativos;
- prevenção de duplicidade por `memberId + competencyYear + competencyMonth`;
- lançamento manual de mensalidade;
- configuração de valor padrão e dia padrão de vencimento em `SystemSetting`;
- registro de pagamento com forma e data;
- geração automática de `CashTransaction` do tipo `INCOME` ao confirmar pagamento;
- isenção com motivo e auditoria;
- cancelamento sem exclusão física;
- criação automática de `REVERSAL` no caixa quando uma mensalidade paga é cancelada;
- histórico financeiro vinculado ao lançamento;
- novas permissões `fees.*` para RBAC;
- seed de formas de pagamento, categoria financeira `Mensalidades` e configurações padrão.

### Permissões da etapa

- `fees.view`: Admin, Presidente, Tesoureiro e Secretário.
- `fees.create`: Admin, Presidente e Tesoureiro.
- `fees.generate`: Admin, Presidente e Tesoureiro.
- `fees.pay`: Admin, Presidente e Tesoureiro.
- `fees.exempt`: Admin, Presidente e Tesoureiro.
- `fees.cancel`: Admin, Presidente e Tesoureiro.

### Seed obrigatório após atualizar esta etapa

Execute novamente o seed para criar as novas permissões, formas de pagamento e categoria de caixa:

```bash
npm run prisma:seed
```

O `schema.prisma` da Etapa 04 já possuía as entidades necessárias para este fluxo, então esta etapa não exige uma alteração estrutural obrigatória no banco se a migration inicial já foi aplicada.

### Validação

A instalação de dependências foi tentada no ambiente de geração, mas o `npm install` excedeu o limite operacional disponível. Por isso, execute localmente:

```bash
npm install
npx prisma generate
npx prisma validate
npm run build
```


## Etapa 06 — Financeiro e Caixa

Esta etapa adiciona:

- extrato financeiro com filtros por período, tipo, categoria e descrição;
- lançamentos manuais de receitas e despesas;
- vínculo opcional com evento;
- formas de pagamento e categorias configuráveis;
- abertura de caixa com saldo inicial;
- fechamento com saldo esperado, contado e diferença;
- vínculo automático de novos lançamentos ao caixa aberto;
- estornos com registro de reversão, sem exclusão física;
- auditoria para lançamentos, abertura, fechamento e estornos;
- permissões `finance.*` e `cash.*` para Admin, Presidente e Tesoureiro;
- histórico dos últimos caixas fechados.

### Alteração de banco nesta etapa

`CashRegister` passou a registrar `openedById` e `closedById`. Gere uma migration antes de usar esta versão em um banco existente.


## Etapa 07

Consulte `ETAPA-07.md` para detalhes do módulo de Eventos.


## Etapa 08

Veja `ETAPA-08.md`. Esta etapa implementa inscrições públicas, participantes, benefícios e PIX manual.


## Etapa 09

Adicionado módulo completo de estoque com produtos, categorias, ledger de movimentações, saldo derivado, estoque mínimo, entradas, saídas, ajustes, reversões, vínculo com eventos, permissões e auditoria. Veja `ETAPA-09.md`.


## Etapa 10 — Comandas

Comandas públicas por token, consumo administrado pela equipe, estoque transacional, fechamento e PIX manual com confirmação administrativa e integração ao financeiro. Consulte `ETAPA-10.md`.

## Etapa 11 — Dashboard e Relatórios Integrados

Esta etapa conecta o painel administrativo aos dados reais e adiciona uma central de relatórios:

- Dashboard com membros, financeiro, mensalidades, comandas, eventos e estoque.
- `/admin/relatorios/financeiro`
- `/admin/relatorios/mensalidades`
- `/admin/relatorios/estoque`
- `/admin/relatorios/eventos`
- Permissão `reports.view`.

Não há alteração estrutural no banco nesta etapa. Execute o seed para registrar a nova permissão e seus vínculos de role.


## Etapa 12

Adiciona operação de eventos, check-in manual/QR protegido, presença, pendências e fechamento operacional consolidado. Consulte `ETAPA-12.md`.

### Validação da Etapa 12

Foi realizada revisão estrutural das rotas, permissões e relações Prisma. A instalação completa das dependências (`npm install`) foi tentada neste ambiente, mas excedeu o limite operacional; execute `npm install`, `npx prisma validate` e `npm run build` localmente antes do deploy.


## Etapa 13

Exportações CSV/XLSX/PDF e recibos administrativos. Consulte `ETAPA-13.md`.

## Etapa 14 — Produção e Segurança

A Etapa 14 adiciona hardening para homologação/produção: rate limiting persistente, health check, headers de segurança, logging estruturado, auditoria com IP/User-Agent, idempotência financeira, transações serializáveis para capacidade de eventos, validação de ambiente e documentação de deploy/rollback.

Também corrige a política de migrations: `prisma/migrations` deve ser versionada e produção deve usar `prisma migrate deploy`.

Consulte `ETAPA-14.md`, `SECURITY.md` e `DEPLOY-PRODUCAO.md`.

## Etapa 15 — Performance e Fluidez

A Etapa 15 otimiza as consultas mais pesadas e melhora o feedback de navegação e de ações administrativas. Consulte `ETAPA-15.md`.

### Índices em MySQL hospedado

Se `prisma migrate dev` não puder criar shadow database, os índices desta etapa podem ser aplicados pelo arquivo:

```text
prisma/manual/etapa-15-performance-indexes.sql
```

Não execute o arquivo repetidamente. Verifique os índices existentes antes de aplicar em um banco já alterado manualmente.

### Smoke test de performance

Com dependências instaladas e `DATABASE_URL` configurada:

```bash
npm run perf:smoke
```

## Etapa 16 — Carregamento global

Foi adicionada uma camada global de feedback para operações assíncronas. Navegações internas, filtros, Server Actions e login agora exibem um overlay `Processando...` acima de toda a interface até a conclusão da operação. Consulte `ETAPA-16.md`.

## Etapa 17 — Comandas sem evento

O módulo de comandas também funciona fora de eventos. Em `/comanda`, use **Reunião / consumo sem evento** para abrir uma comanda avulsa. Ela usa `origin=MANUAL`, não possui `eventId`, mas participa normalmente do estoque, PIX manual, confirmação de pagamento, financeiro e exportações.

## Etapa 18 — Autoatendimento das comandas

A visão pública da comanda permite adicionar consumos e fechar a própria comanda sem login. Remoções/cancelamentos continuam restritos à área administrativa autenticada. Valores e disponibilidade de estoque são validados exclusivamente no servidor.


## Etapa 19 — Retomada de comanda por celular

A página inicial possui atalho para comanda avulsa. Ao informar nome e celular, o sistema reutiliza a comanda `OPEN` mais recente daquele telefone; uma nova só é criada quando não existe comanda aberta para o número. Consulte `ETAPA-19.md`.


## Etapa 20

Quantidades de estoque e consumo ajustadas para incremento de 1 em 1. Consulte `ETAPA-20.md`.


## Etapa 21

Links de retorno à página inicial adicionados às páginas públicas abertas. Consulte `ETAPA-21.md`.
