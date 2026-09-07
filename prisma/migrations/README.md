# Migrations

A partir da Etapa 14 esta pasta deve ser versionada.

Como os snapshots anteriores não mantinham o histórico de migrations, gere a migration baseline em um banco de desenvolvimento limpo:

```bash
npx prisma migrate dev --name baseline
```

Revise o SQL gerado e versione a pasta criada. Em produção use somente:

```bash
npx prisma migrate deploy
```
