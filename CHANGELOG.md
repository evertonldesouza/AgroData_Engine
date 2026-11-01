# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [3.2.0] — 2026-11-01

Rodada de **padronização e documentação verificada**. Sem mudança de contrato: a API
responde exatamente o mesmo; o que muda é a garantia de que o "porquê" fica registrado.

### Adicionado

- **Documentação com dono único** — [`docs/README.md`](./docs/README.md) indexa os
  documentos, responde "onde documentar o quê" e define a definição de pronto; novas
  páginas de [padrões de código](./docs/padroes-codigo.md), [testes](./docs/testes.md),
  [segurança](./docs/seguranca.md) e [CI/CD](./docs/ci-cd.md).
- **`CI · Docs`** — workflow que roda `scripts/check_docs.py`: documento obrigatório
  ausente, página fora do índice, ADR sem entrada na tabela, link relativo quebrado e
  cerca de código sem par reprovam o PR. Emite aviso quando `src/` muda sem documento.
- **ADR 0008** — documentação como critério de aceite, com as alternativas descartadas
  (wiki, doc gerada do código, bloqueio total) e os limites do check.
- **Versão do dashboard injetada no build** (`__APP_VERSION__` a partir do
  `package.json`), fim do `v3.0` escrito à mão na UI.

### Alterado

- **README** revisado: seção "Padrões e documentação" com a tabela de documentos, tabela
  de qualidade com o gate de cada suíte, ADRs 0006–0008 na lista, estrutura do repositório
  e roadmap atualizados; badges de `CI · Docs` e `Security`.
- **`docs/arquitetura.md`** alinhado ao código: camada de cache no ciclo de uma
  requisição, coletor CEPEA e retry de escrita no data engine, alertas e exportação CSV no
  frontend, `/metrics` na operação, bundle inicial e limites conhecidos corrigidos.
- **`CONTRIBUTING.md`, `AGENTS.md` e `SECURITY.md`** passam a apontar para o documento
  certo em vez de repetir regra solta.
- Versão **3.2.0** sincronizada em `package.json`, `pyproject.toml` e no fallback do
  pacote Python.

### Segurança

- Nenhum controle novo; o inventário existente (CORS, rate limit, imagem non-root,
  CodeQL, auditoria de dependências) agora está em [`docs/seguranca.md`](./docs/seguranca.md)
  com o caminho do código e o teste que o cobre.

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
