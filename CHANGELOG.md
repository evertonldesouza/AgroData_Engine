# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [3.1.0] — 2026-10-24

Rodada de robustez de produção, produto e observabilidade. Sem mudanças incompatíveis:
todos os endpoints novos são aditivos e o banco permanece igual.

### Adicionado

- **API:** `ETag` forte derivado do conteúdo, `Last-Modified`, `Cache-Control` e
  `304 Not Modified` em `/api/commodities` e `/history`; cache em processo com TTL e
  *single-flight* (`Caching:{Enabled,SnapshotSeconds,HistorySeconds}`); rota
  `GET /api/commodities/{id}`; `GET /api/commodities/export` (CSV com ponto decimal e
  timestamps UTC); `GET /api/alerts` (limiares `Alerts:{ThresholdPercent,SeverePercent,MaxAlerts}`).
- **Observabilidade:** `GET /metrics` no formato Prometheus (contadores por rota/status,
  histograma de latência, requisições em voo) e header `X-Response-Time-Ms` em toda resposta.
- **Data engine:** coletor **CEPEA/ESALQ** (`DATA_SOURCE=cepea`, parser de tabela HTML),
  comando `agrodata verify-source --html <arquivo>` para validar o parser offline; retry com
  backoff na escrita no banco (`DB_CONNECT_ATTEMPTS`, `DB_RETRY_BACKOFF_SECONDS`).
- **Frontend:** painel e badge de alertas de variação; botão de exportação CSV por commodity;
  poller dedicado de alertas com degradação silenciosa.
- **CI/Segurança:** workflow `security.yml` com CodeQL (C#, TypeScript, Python),
  `dotnet list package --vulnerable`, `npm audit --omit=dev` e `pip-audit`, incluindo execução
  semanal agendada.
- **Docs:** ADRs 0006 (cache/`ETag`) e 0007 (métricas Prometheus).

### Alterado

- `GET /api/commodities` e `/history` passam a responder com validadores HTTP; com
  `Caching:Enabled=false` o servidor responde `max-age=0, must-revalidate`.
- `data-pipeline.yml`: o `agrodata check` é informativo (`continue-on-error`) e publica o
  resumo da configuração no *step summary* — o retry do pipeline é quem decide o resultado.
- Dependências de teste alinhadas em 10.0.13 (`Microsoft.AspNetCore.Mvc.Testing`,
  `Microsoft.EntityFrameworkCore.Sqlite`).

### Corrigido

- `PipelineReport.inserted` contava amostras mesmo quando a escrita falhava; agora só conta
  o que foi efetivamente persistido.
- Relatório de falhas de teste no CI do backend passa a publicar as mensagens no resumo do job.

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
