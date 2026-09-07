# Segurança

## Controles implementados na Etapa 14

- Next.js atualizado para uma versão corrigida da linha 15.
- Banco marcado como `server-only`, reduzindo risco de import acidental em Client Components.
- Headers HTTP defensivos globais.
- `poweredByHeader` desativado.
- Rate limiting persistente em MySQL para login, inscrição pública e abertura pública de comanda.
- Honeypot simples nos formulários públicos para reduzir automação básica.
- Tokens públicos de comanda usam 256 bits aleatórios.
- Confirmações financeiras possuem `sourceKey` único para idempotência.
- Reserva de vagas usa transação `SERIALIZABLE` com retry de conflito.
- Auditoria passa a registrar IP e User-Agent quando disponíveis.
- Endpoint `/api/health` não retorna credenciais nem detalhes internos de exceção.
- `robots.txt` evita indexação de rotas administrativas, APIs e tokens públicos.

## Antes da produção

1. Rotacione qualquer senha de banco que já tenha sido compartilhada fora de um gerenciador seguro.
2. Use um `AUTH_SECRET` aleatório com pelo menos 32 caracteres.
3. Não use `NEXT_PUBLIC_` para segredos.
4. Configure HTTPS e domínio definitivo antes de liberar usuários.
5. Restrinja o usuário MySQL ao banco e privilégios necessários à aplicação.
6. Habilite backup automático e teste a restauração.
7. Verifique logs de autenticação, pagamentos, estornos, alterações financeiras e estoque.
8. Defina política de retenção de `AuditLog` e `RateLimitBucket`.

## Rate limiting

O limitador desta versão usa a própria base MySQL, portanto funciona entre instâncias serverless diferentes. Isso é preferível a um `Map` em memória em Vercel, que não seria compartilhado entre invocações.

Limites iniciais:

- login: 8 tentativas / 15 minutos por IP;
- inscrição pública: 8 tentativas / 10 minutos por IP e evento;
- abertura de comanda: 6 tentativas / 10 minutos por IP.

Esses valores podem ser ajustados após observar o tráfego real.
