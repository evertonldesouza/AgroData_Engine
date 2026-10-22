# Política de segurança

## Versões suportadas

| Versão | Suporte |
| --- | --- |
| 3.x | ✅ |

## Reportando uma vulnerabilidade

Não abra uma issue pública. Envie um e-mail para o mantenedor
(`evertonldesouza` no GitHub) com:

- descrição e impacto;
- passos para reproduzir;
- versão/commit afetado.

Resposta esperada em até 5 dias úteis. Você receberá crédito no `CHANGELOG` (quando
existir) caso deseje.

## Práticas adotadas

- Nenhum segredo versionado: conexões vêm de env vars / secrets do GitHub Actions.
- CORS restrito às origens do produto (`Cors:AllowedOrigins` + `FRONTEND_URL`).
- Rate limiting de 120 req/min por IP.
- Problem Details sem stack trace; logs com `traceId` para correlação.
- Dependências monitoradas pelo Dependabot (NuGet, npm, pip e Actions).
- Imagem Docker roda com usuário não-root e healthcheck em `/health/live`.
- API somente leitura: não há endpoint que aceite payload de escrita ([ADR 0004](./docs/adr/0004-public-read-only-api.md)).

## Escopo

Este é um projeto de demonstração com dados simulados. Ainda assim, reporte qualquer
comportamento inesperado: a correção é aplicada na `main` e documentada no PR.
