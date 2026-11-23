# Segurança

Controles que existem **hoje**, onde cada um está no código e o que revisar antes
de aprovar um PR. A política de reporte de vulnerabilidade fica em
[`SECURITY.md`](../SECURITY.md); este documento é o mapa técnico.

## Modelo de ameaça

| Ativo | Exposição | Impacto se comprometido |
| --- | --- | --- |
| Credencial do PostgreSQL | secret do GitHub Actions (ingestão) e env var do Render (API) | escrita/leitura total do warehouse |
| API pública | internet | abuso de cota, custo de Render, leitura de dados públicos |
| Dashboard | GitHub Pages (estático) | nada além de conteúdo já público |
| Cadeia de dependências | NuGet, npm, PyPI, Actions | execução de código no CI |

Não há dado pessoal, autenticação de usuário nem escrita pela API — o desenho é
deliberadamente de **superfície mínima** ([ADR 0004](./adr/0004-public-read-only-api.md)).

## Controles implementados

| Controle | Onde | Verificação |
| --- | --- | --- |
| Nenhum segredo versionado | `appsettings.json` traz `DefaultConnection` vazia; produção usa `ConnectionStrings__DefaultConnection` (Render) e `secrets.DATABASE_URL` (Actions) | revisão de PR + CodeQL |
| CORS por allowlist | `ApiPolicies.FrontendCors` + `Cors:AllowedOrigins` (+ fallback `FRONTEND_URL`) | testes de contrato da API |
| Rate limiting | 120 req/min por IP, janela fixa, `QueueLimit=0` → `429` imediato | teste de contrato + `docs/api.md` |
| Erro sem vazamento | `GlobalExceptionHandler`: `500` com `ProblemDetails`, `traceId`, sem stack trace | `AgroData.Tests/Api` |
| Superfície somente leitura | nenhum método `POST/PUT/DELETE` mapeado | revisão + Swagger |
| Imagem não-root | `Dockerfile` multi-stage com `USER $APP_UID` e healthcheck | job `Build container image` |
| Health check sem detalhe sensível | `/health` expõe status e duração; a connection string aparece mascarada (`masked_database_url`) | `docs/api.md` |
| Cache público sem dado privado | `Cache-Control: public` só nas rotas de leitura pública | `CachingEndpointTests` |
| Cadeia de dependências | Dependabot (NuGet, npm, pip, Actions) + `security.yml` | `Dependency audit` |
| Análise estática | CodeQL com `security-and-quality` em C#, TypeScript e Python | `CodeQL (…)` |
| Auditoria de vulnerabilidade | `dotnet list package --vulnerable --include-transitive`, `npm audit --omit=dev --audit-level=high`, `pip-audit --strict` | `Dependency audit`, semanal |
| Divulgação responsável | `SECURITY.md` (canal privado, prazo de resposta) | GitHub → Security |

## Checklist de segurança no PR

- [ ] Nenhum segredo, token, connection string ou `.env` real no diff.
- [ ] Endpoint novo: tem `CancellationToken`, validação de entrada e aparece em
      `docs/api.md` (incluindo o código de erro).
- [ ] Endpoint que **escreve** (hoje não existe): só entra junto com autenticação,
      validação de payload, rate limit próprio e ADR.
- [ ] CORS: origem nova entra em `Cors:AllowedOrigins` — nunca `AllowAnyOrigin`.
- [ ] Resposta de erro não carrega stack trace, SQL, caminho de arquivo ou nome de
      tabela.
- [ ] Configuração nova tem default seguro (desligado, restrito, sem credencial).
- [ ] Dependência nova: versão fixa no `Directory.Packages.props` /
      `package.json` / `pyproject.toml` e justificativa no PR.
- [ ] Se o comportamento muda a postura (ex.: `/metrics` público), a limitação
      fica escrita aqui.

## Limitações aceitas (e o que fazer a respeito)

| Limitação | Por que foi aceita | Mitigação |
| --- | --- | --- |
| API sem autenticação | é leitura pública por definição (ADR 0004) | rate limit por IP; nenhuma escrita |
| `429`/`403` dependem do IP de borda | Render/proxy pode mascara o IP real | limite é antiabuso, não fronteira de segurança |
| `/metrics` e `/swagger` públicos | portfólio: queremos que sejam vistos | filtrar no reverse proxy se virar produto pago |
| Sem WAF/bot protection | custo e escopo | rate limit + cache HTTP reduzem o efeito de scraping |
| TLS do banco definido na connection string | depende do provedor (Supabase) | usar `sslmode=require` no secret de produção |
| Cobertura de authz/RBAC ausente | não há papéis | ADR novo quando existir escrita |

## Quando um controle novo é adotado

1. Implementar + testar (o teste é a prova de que o controle existe).
2. Adicionar a linha na tabela **Controles implementados** com o caminho do código.
3. Se mudar comportamento visível (ex.: novo `429`, header novo), atualizar
   [`api.md`](./api.md).
4. Se for decisão estrutural (ex.: adotar JWT), abrir ADR e atualizar
   [`adr/README.md`](./adr/README.md).
5. Registrar no `CHANGELOG.md`, na seção de segurança quando for o caso.

Sem o passo 2 o controle volta a ser folclore: alguém remove e ninguém percebe.
