# Deploy de produção — Vercel + MySQL

## 1. Credenciais

Antes do deploy, rotacione credenciais que tenham sido compartilhadas em texto ou usadas em testes. Nunca commit `.env`, `.env.local` ou senhas reais.

Configure na Vercel, por ambiente:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL=https://SEU_DOMINIO`
- `LOG_LEVEL=info`

As variáveis `ADMIN_*` são necessárias apenas se você optar por executar o seed que cria o usuário inicial. Depois, remova a senha administrativa do ambiente quando não for mais necessária.

## 2. MySQL e conexões serverless

O Prisma Client já é instanciado fora dos handlers e não executa `$disconnect()` a cada request.

O `.env.example` usa `connection_limit=3&pool_timeout=10` como ponto inicial conservador para ambiente serverless sem pooler externo. Ajuste conforme o limite real da hospedagem MySQL e a concorrência da aplicação.

Confirme com a hospedagem MySQL:

- acesso remoto a partir da Vercel;
- exigência/configuração de TLS/SSL;
- limite máximo de conexões simultâneas;
- política de timeout;
- backups automáticos e retenção;
- região/datacenter do banco.

Escolha a região de execução da Vercel o mais próxima possível do MySQL.

## 3. Migrations

A pasta `prisma/migrations` NÃO é mais ignorada pelo Git.

Para um projeto ainda sem histórico de migrations, gere a migration inicial em um banco de desenvolvimento limpo e revise o SQL antes de versioná-la:

```bash
npx prisma migrate dev --name baseline
```

Depois de revisar e commitar `prisma/migrations`, produção deve usar:

```bash
npx prisma migrate deploy
```

Não use `prisma db push` como processo normal de atualização de produção.

## 4. Verificações locais/CI

Gere e versione `package-lock.json` assim que a instalação das dependências for concluída com sucesso. Depois disso, prefira `npm ci` no CI.

```bash
npm install
npm run env:check
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
```

Quando houver migrations novas, aplique `npm run prisma:migrate:deploy` em uma etapa controlada do pipeline ou manualmente antes de liberar tráfego à versão que depende delas.

## 5. Health check

`GET /api/health`

- `200`: aplicação e banco respondendo;
- `503`: aplicação respondeu, mas o banco não está disponível.

A resposta não contém host, usuário, senha ou stack trace.

## 6. Rollback

Antes de migration destrutiva:

1. gere backup;
2. teste restauração;
3. revise SQL da migration;
4. faça deploy da migration compatível com a versão atual;
5. só depois libere código que dependa dos novos campos.

Mudanças destrutivas devem usar estratégia expand/contract em vez de remover coluna/tabela no mesmo deploy.

## 7. Checklist de liberação

- [ ] Credencial MySQL rotacionada.
- [ ] `AUTH_SECRET` forte configurado.
- [ ] URL HTTPS definitiva configurada.
- [ ] Banco aceita conexão da infraestrutura escolhida.
- [ ] Limite de conexões do MySQL conhecido.
- [ ] Backup e restauração testados.
- [ ] Migrations versionadas.
- [ ] `prisma migrate deploy` testado em staging.
- [ ] `npm run predeploy:check` aprovado.
- [ ] Login testado com usuário ativo e bloqueado.
- [ ] Rate limiting testado.
- [ ] Inscrição pública testada.
- [ ] Comanda pública testada.
- [ ] Confirmação PIX manual testada sem gerar receita duplicada.
- [ ] Estorno financeiro testado.
- [ ] Check-in e reversão testados.
- [ ] `/api/health` testado.
- [ ] Logs verificados sem exposição de segredos.
