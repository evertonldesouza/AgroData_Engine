# Testes

Este documento fixa **o que é testado, com qual ferramenta e qual é o piso de
cobertura**. Mudou a estratégia de teste? A mudança entra aqui no mesmo PR.

## Piso e estado atual

| Módulo | Ferramenta | Casos | Cobertura medida | Gate |
| --- | --- | --- | --- | --- |
| Backend | xUnit · Moq · `WebApplicationFactory` sobre SQLite | 103 | coletada por `coverlet` e publicada como artefato | — (ver nota) |
| Data engine | pytest · `pytest-cov` | 75 | 94% de linhas | **80%** (`--cov-fail-under=80`) |
| Frontend | Vitest · `renderToStaticMarkup` · `@vitest/coverage-v8` | 87 | 98% de linhas em `src/lib` e `src/api` | **80%** linhas/funções |

> **Nota sobre o backend:** o CI coleta cobertura (`--collect:"XPlat Code Coverage"`)
> e publica o `.trx` + relatório como artefato por 7 dias, mas **ainda não impõe
> um limite numérico**. O motivo é honesto: o gate seria medido apenas no CI e é
> fácil de "ajustar" sem olhar; o que segura a qualidade do backend hoje é o
> teste de contrato da API (pipeline HTTP real + SQLite) e a revisão de PR.
> Colocar um gate explícito está no roadmap — quando entrar, entra também uma
> linha nesta tabela.

Os números acima são atualizados quando o PR muda a suíte. Se o número no README
divergir, o README está errado.

## Pirâmide por módulo

### Backend

| Nível | O que cobre | Exemplo |
| --- | --- | --- |
| Unidade pura | regras sem I/O: `TrendCalculator`, `AlertEvaluator`, `EntityTags`, `HistoryCsv`, `TtlCache` | `AgroData.Tests/Application`, `AgroData.Tests/Api/EntityTagsTests` |
| Integração de serviço | decorator de cache, repositório, mapeamento DTO | `CachedCommodityServiceTests` |
| Contrato HTTP | pipeline real (middleware, roteamento, JSON, rate limit) sobre SQLite em memória | `ApiFactory` + `CachingEndpointTests`, `AlertsAndExportEndpointTests` |

O `ApiFactory` troca o provider do EF Core para SQLite mantendo o pipeline
completo — testar o controller isolado esconderia exatamente o que quebra
(headers, status code, serialização de enum).

### Data engine

| Nível | O que cobre |
| --- | --- |
| Unidade | `analytics`, `schemas`, `config` (validação), parser CEPEA (`parse_number`, `parse_page`) |
| Integração | pipeline completo contra SQLite em memória: dedupe, isolamento de erro, retry de escrita, `inserted` só conta o que persistiu |
| CLI | `main([...])` com `capsys`, incluindo `verify-source` sobre fixture versionada |

Collectors são testados com sessão HTTP falsa (`_FakeSession`), nunca com rede.

### Frontend

| Nível | O que cobre |
| --- | --- |
| Unidade | `lib/` (format, normalize, series, symbols, alerts) e `api/` (client, endpoints) |
| Render estático | `renderToStaticMarkup` em todo componente com regra de exibição |
| Hook | `useCommodities` (backoff), `useAlerts` (degradação silenciosa) |

Não há teste de browser no CI: o custo (Playwright + navegador) não se paga para
uma SPA sem formulário. O smoke test é o build + o deploy do Pages.

## O que cada tipo de mudança exige

| Mudança | Teste obrigatório |
| --- | --- |
| Rota/campo novo na API | teste de contrato (`ApiFactory`) + caso de erro (`400`/`404`) |
| Regra de negócio | unidade pura, com `[Theory]`/`parametrize` para os limites |
| Bug corrigido | **teste de regressão que falha antes do fix** (descreva no PR) |
| Coletor novo | parser com fixture versionada + falha de rede/timeout |
| Componente/hook novo | render estático ou teste do hook com `fetch` mockado |
| Refactor sem mudança de comportamento | suíte existente passa sem alteração; se precisou mudar teste, não era refactor |

## Convenções

- **Nome descreve comportamento**, não implementação:
  `Snapshots_are_reloaded_after_the_ttl`, `test_parse_number_rejects_garbage`.
- **AAA explícito** quando há mais de três linhas; sem comentário decorativo.
- **Sem `sleep`**: relógio injetável (`TimeProvider` + `ManualTimeProvider` no
  .NET; deslocamento manual no Python).
- **Mock estrito** (`MockBehavior.Strict`): chamada não prevista falha o teste —
  foi assim que um teste de cache revelou que a chave normalizada não cobria a
  grafia do símbolo.
- **Asserção sobre contrato, não sobre implementação**: compare status/headers/
  corpo, não a ordem de chamadas internas.
- **Fixture é código**: HTML do CEPEA, respostas HTTP e séries ficam versionados
  em `tests/fixtures/` e são a referência do parser.

## Como rodar

```bash
# Backend
dotnet test src/backend/AgroData.Tests

# Data engine
cd src/data-engine && pytest              # inclui o gate de 80%
pytest --no-cov -q                        # rápido, sem cobertura

# Frontend
cd src/frontend && npm run test
npm run test:coverage                     # aplica thresholds do vitest.config.js
```

## Anti-padrões já encontrados neste projeto

Registrados porque voltam: cada um custou um diagnóstico.

- `cmd | tee arquivo` sem `set -o pipefail` **mascarou** falha de teste no CI.
- `Assert.NotEqual` em ETag assumindo que o `id` entra no hash (não entra).
- Mock estrito que previa a grafia normalizada do símbolo, mas o decorator
  repassa o valor original e só normaliza a chave do cache.
- Cobertura verde com teste que só exercita caminho felizes: o gate de 80% não
  substitui revisão.
