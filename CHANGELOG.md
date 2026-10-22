# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [3.0.0] — 2026-10-22

Reescrita estrutural dos três módulos, mantendo a compatibilidade do banco.

### Adicionado

- **API:** endpoint `/api/commodities/history` com média móvel; health checks de
  liveness/readiness; Problem Details (RFC 9457) e exception handler global; rate limiting
  por IP; compressão de resposta; CORS configurável; índices `IX_Commodities_Symbol` e
  `IX_Commodities_Symbol_Timestamp` (nova migration).
- **Data engine:** pacote `agrodata` instalável com CLI (`collect`, `analyze`, `init-db`,
  `check`, `version`); configuração validada com pydantic; coletor HTTP com retry/backoff;
  deduplicação opcional; relatório estruturado de execução; 41 testes com 93% de cobertura.
- **Frontend:** gráfico com histórico real da API (não mais derivado do polling); seleção
  de intervalo; tabela de leituras; normalizador compatível com o contrato anterior;
  lazy loading do Recharts; error boundary; testes com Vitest.
- **Infra:** Dockerfile multi-stage com usuário não-root e healthcheck; docker-compose com
  healthcheck do banco; workflows de CI por domínio; deploy do dashboard via Pages;
  Dependabot; `Directory.Build.props` + Central Package Management; ADRs e documentação da API.

### Alterado

- `GET /api/commodities` agora retorna `previousPrice`, `delta`, `deltaPercent`,
  `trend` (`up`/`down`/`flat`) e `history`.
- Política de CORS lê `Cors:AllowedOrigins` (mantendo `FRONTEND_URL` como fallback).
- Consulta de snapshot passou a garantir as N cotações mais recentes **por símbolo**
  (antes, um símbolo movimentado podia excluir outro do resultado).

### Removido

- Scripts avulsos em `src/scripts/` (substituídos pelo pacote `agrodata`).
- DTO `CommodityResponse` (substituído por `CommoditySnapshotResponse`).
- Workflows `data-engine.yml`, `deploy-frontend.yml` e `dotnet-tests.yml`
  (substituídos por workflows por domínio).
