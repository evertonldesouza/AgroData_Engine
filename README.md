<div align="center">

# 🌿 AgroData Engine

**Plataforma fullstack de inteligência de preços de commodities agrícolas.**

Do pipeline de ingestão ao dashboard em tempo real — Clean Architecture em .NET 10,
data engine em Python tipado e frontend React 19.

[![CI · Backend](https://github.com/evertonldesouza/AgroData_Engine/actions/workflows/ci-backend.yml/badge.svg)](https://github.com/evertonldesouza/AgroData_Engine/actions/workflows/ci-backend.yml)
[![CI · Frontend](https://github.com/evertonldesouza/AgroData_Engine/actions/workflows/ci-frontend.yml/badge.svg)](https://github.com/evertonldesouza/AgroData_Engine/actions/workflows/ci-frontend.yml)
[![CI · Data Engine](https://github.com/evertonldesouza/AgroData_Engine/actions/workflows/ci-data-engine.yml/badge.svg)](https://github.com/evertonldesouza/AgroData_Engine/actions/workflows/ci-data-engine.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-00d68f.svg)](./LICENSE)

[**Dashboard**](https://evertonldesouza.github.io/AgroData_Engine/) ·
[**API (Swagger)**](https://agro-data-engine.onrender.com/swagger) ·
[**Health**](https://agro-data-engine.onrender.com/health) ·
[Arquitetura](./docs/arquitetura.md) ·
[API](./docs/api.md) ·
[ADRs](./docs/adr/)

<img src="./docs/screenshots/dashboard.png" alt="Dashboard do AgroData Engine" width="100%" />

</div>

---

## O problema

Produtores e analistas acompanham soja e milho em planilhas e portais diferentes:
preço sem histórico comparável, variação calculada à mão e nenhuma visão de tendência.
O AgroData Engine resolve isso com **um único fluxo auditável**: um pipeline coleta as
cotações, grava em PostgreSQL, a API expõe histórico e tendências, e o dashboard
mostra preço, variação e série temporal reais.

| Camada | Responsabilidade | Stack |
| --- | --- | --- |
| **Data engine** | Coleta, validação, cálculo de médias móveis | Python 3.12 · SQLAlchemy · pandas · pydantic |
| **API** | Leitura, agregação, contrato REST | .NET 10 · Clean Architecture · EF Core |
| **Dashboard** | Visualização e monitoramento | React 19 · Vite · Tailwind CSS v4 |
| **Infra** | Banco, CI/CD, deploy | PostgreSQL · Docker · GitHub Actions · Render |

## Destaques de engenharia

- **Clean Architecture de verdade** — quatro camadas com dependências apontando para dentro
  (`Domain ← Application ← Infrastructure ← API`) e regras de negócio puras em
  [`TrendCalculator`](./src/backend/AgroData.Application/Common/TrendCalculator.cs), testáveis sem banco.
- **API pronta para produção** — Problem Details (RFC 9457), exception handler global, health
  checks de *liveness* e *readiness*, rate limiting por IP, compressão de resposta, CORS
  configurável e OpenAPI público em `/swagger`.
- **Data engine tipado e resiliente** — `mypy --strict`, configuração validada com
  `pydantic-settings`, retry com backoff no coletor HTTP, isolamento de erro por símbolo,
  janela de deduplicação e relatório estruturado de cada execução.
- **Frontend honesto** — o gráfico consome `/history` do banco (não inventa pontos a partir do
  polling), com backoff exponencial, pausa em aba oculta, cancelamento de requisições,
  *lazy loading* do Recharts e *error boundary*.
- **146 testes automatizados** — 45 no backend (xUnit + Moq + `WebApplicationFactory` sobre SQLite),
  41 no data engine (93% de cobertura) e 60 no frontend (100% das linhas de `lib/` e `api/`).
- **CI/CD completo** — quatro workflows independentes por domínio, cache de dependências,
  Dependabot agrupado por ecossistema e deploy automático do dashboard no GitHub Pages.

## Arquitetura

```mermaid
flowchart LR
    subgraph Actions["GitHub Actions · cron horário"]
        DE["Data Engine<br/>Python"]
    end

    subgraph DB["PostgreSQL (Supabase)"]
        T[("Commodities<br/>Id · Symbol · Price<br/>Timestamp · Source")]
    end

    subgraph API[".NET 10 API"]
        C["Controllers"] --> S["Application<br/>use cases"]
        S --> D["Domain<br/>entities + contracts"]
        R["Infrastructure<br/>EF Core"] -.implementa.-> D
        S --> R
    end

    FE["React 19 Dashboard<br/>GitHub Pages"]

    DE -- "INSERT (SQLAlchemy)" --> T
    T -- "SELECT (EF Core)" --> R
    FE -- "GET /api/commodities" --> C
    FE -- "GET /api/commodities/history" --> C
    C -- "GET /health/ready" -.-> T
```

Detalhes de camadas, fluxo de uma requisição e modelo de dados em
[`docs/arquitetura.md`](./docs/arquitetura.md).

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/commodities` | Snapshot por commodity: preço, anterior, variação, tendência e sparkline |
| `GET` | `/api/commodities/history?symbol=SOJA&points=60` | Série histórica + média móvel de 7 pontos |
| `GET` | `/api/commodities/{id}` | Cotação individual |
| `GET` | `/health` · `/health/live` · `/health/ready` | Status agregado, liveness e readiness |
| `GET` | `/swagger` | Documentação interativa (OpenAPI) |

```jsonc
// GET /api/commodities
[
  {
    "id": 241,
    "symbol": "SOJA",
    "price": 136.42,
    "previousPrice": 134.21,
    "delta": 2.21,
    "deltaPercent": 1.65,
    "trend": "up",
    "timestamp": "2026-10-22T14:02:00Z",
    "source": "Simulated Market Data",
    "history": [130.1, 132.4, 134.21, 136.42]
  }
]
```

Contrato completo, erros e versionamento em [`docs/api.md`](./docs/api.md).

## Rodando localmente

Pré-requisitos: Docker, .NET 10 SDK, Node 20+ e Python 3.11+.

```bash
# 1. Banco + API em containers
cp .env.example .env
docker compose up -d --build
# API:      http://localhost:5072/swagger
# Health:   http://localhost:5072/health

# 2. Popular o banco com cotações
cd src/data-engine
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
export DATABASE_URL="postgresql://admin:mysecretpassword@localhost:5432/agro_data_engine"
agrodata init-db && agrodata collect

# 3. Dashboard
cd ../../src/frontend
npm install && npm run dev
# http://localhost:5173
```

Sem Docker? Rode a API com `dotnet run --project src/backend/AgroData.API` e suba o
PostgreSQL com `docker compose up -d database`.

## Qualidade

```bash
# Backend (.NET)
dotnet test src/backend/AgroData.Tests

# Data engine (Python)
cd src/data-engine && pytest && ruff check . && mypy agrodata

# Frontend (React)
cd src/frontend && npm run lint && npm run test && npm run build
```

| Suíte | Ferramentas | Casos |
| --- | --- | --- |
| Backend | xUnit · Moq · SQLite · `WebApplicationFactory` | 45 |
| Data engine | pytest · cobertura 93% | 41 |
| Frontend | Vitest · `renderToStaticMarkup` · cobertura 100% | 60 |

Os três conjuntos rodam em workflows separados, acionados apenas quando a pasta
correspondente muda.

## Decisões de engenharia

Trade-offs documentados como ADRs — o "porquê" importa mais que o "o quê":

- [ADR 0001](./docs/adr/0001-clean-architecture.md) — quatro camadas e a direção das dependências
- [ADR 0002](./docs/adr/0002-shared-postgres-schema.md) — um schema, dois runtimes (Python + .NET)
- [ADR 0003](./docs/adr/0003-per-symbol-queries.md) — consultas por símbolo em vez de window function
- [ADR 0004](./docs/adr/0004-public-read-only-api.md) — API pública somente leitura, sem JWT
- [ADR 0005](./docs/adr/0005-polling-over-websockets.md) — polling com backoff em vez de WebSocket

## Estrutura do repositório

```text
.
├── src/
│   ├── backend/                 # .NET 10 — 4 projetos + testes
│   │   ├── AgroData.Domain/         # entidades, enums, contratos
│   │   ├── AgroData.Application/    # DTOs, use cases, regras de preço
│   │   ├── AgroData.Infrastructure/ # EF Core, repositórios, migrations
│   │   ├── AgroData.API/            # controllers, middleware, health checks
│   │   └── AgroData.Tests/          # unitários, integração e API
│   ├── data-engine/             # pacote Python instalável (`agrodata`)
│   └── frontend/                # React 19 + Vite + Tailwind v4
├── docs/                        # arquitetura, API, ADRs, screenshots
├── .github/workflows/           # CI por domínio + deploy + ingestão horária
├── Dockerfile · docker-compose.yml · render.yaml
└── README.md
```

## Roadmap

- [ ] Autenticação JWT + RBAC para endpoints administrativos ([ADR 0004](./docs/adr/0004-public-read-only-api.md))
- [ ] Coletor HTTP para uma fonte real de cotações (CEPEA) — o contrato já existe em `collectors/http.py`
- [ ] Alertas de variação por e-mail/Telegram
- [ ] Séries de médias móveis persistidas no warehouse (hoje calculadas on-the-fly)
- [ ] Painel de observabilidade (OpenTelemetry → Grafana)

## English summary

**AgroData Engine** is a full-stack commodity price intelligence platform for the
Brazilian agribusiness market. A typed Python ingestion engine collects prices into
PostgreSQL, a .NET 10 API built with Clean Architecture exposes them with trend
analytics, and a React 19 dashboard renders real historical series with polling,
backoff and accessibility in mind. The repository ships with 136 automated tests,
four CI workflows, Docker/Render deployment and documented architecture decisions.

---

<div align="center">

Desenvolvido por **Everton L. de Souza** · [MIT](./LICENSE)

</div>
