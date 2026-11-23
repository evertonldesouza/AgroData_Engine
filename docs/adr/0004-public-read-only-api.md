# ADR 0004 — API pública somente leitura, sem JWT

- **Status:** aceito (com roadmap de autenticação)
- **Data:** 2026-10

## Contexto

O repositório é um projeto de portfólio com demo pública. Uma versão anterior da
documentação anunciava "JWT + RBAC", mas não havia autenticação implementada — anúncio
sem código é pior que ausência de recurso.

## Decisão

Assumir explicitamente que a API é **pública e somente leitura**:

- Nenhum endpoint escreve dados; a ingestão acontece no pipeline Python.
- Rate limiting de 120 req/min por IP, CORS restrito às origens do produto e
  Problem Details sem vazamento de stack trace.
- Documentação (Swagger) pública de propósito: é a porta de entrada para quem avalia o
  projeto.
- JWT + RBAC entram no roadmap junto com endpoints de escrita (alertas, cadastro de
  commodities).

## Consequências

- **Positivo:** demo funciona sem credenciais; revisor abre `/swagger` e testa na hora.
- **Positivo:** superfície de ataque mínima — não há sessão, cookie ou segredo no cliente.
- **Negativo:** não demonstra autorização. Compensado pela documentação honesta e pelo
  roadmap; a estrutura de `Application` já permite adicionar políticas sem alterar as
  regras de preço.
