# Regras do Projeto

Convenções e fluxo de trabalho deste repositório — leia antes de contribuir.

## Stack

- **Backend:** .NET 10, C#, EF Core + Npgsql, xUnit + Moq
- **Frontend:** React 19 (JSX), Vite, Tailwind CSS v4, Vitest
- **Data engine:** Python 3.12, SQLAlchemy, pandas, pydantic
- **Banco:** PostgreSQL (Supabase)
- **Infra:** GitHub Actions, Docker, Render, GitHub Pages

## Convenções

- Classes/métodos em PascalCase (C#); variáveis locais em camelCase.
- Endpoints REST no plural (`/api/commodities`), somente leitura.
- `async`/`await` com sufixo `Async` e `CancellationToken` propagado.
- Regras de preço vivem em `AgroData.Application` (nunca no controller).
- Repositórios usam `AsNoTracking`; nenhuma query fora de `Infrastructure`.
- Python: tipagem completa, `mypy --strict`, sem `print` (usar `logging`).
- Frontend: lógica pura em `src/lib` com teste; componentes sem cálculo pesado.
- CORS restrito via `Cors:AllowedOrigins` ou `FRONTEND_URL`.
- Segredos só em env vars/secrets — nunca no código ou em `appsettings.json`.

## Estrutura mental

```text
src/backend/AgroData.Domain          entidades e contratos
src/backend/AgroData.Application     use cases + TrendCalculator
src/backend/AgroData.Infrastructure  EF Core, repositórios, migrations
src/backend/AgroData.API             controllers, middleware, DI
src/data-engine/agrodata             pacote Python (collect, analyze, check)
src/frontend/src                     api/, hooks/, lib/, components/
```

## Comandos

```bash
# Backend
dotnet test src/backend/AgroData.Tests
dotnet run --project src/backend/AgroData.API

# Data engine
cd src/data-engine
pytest && ruff check . && mypy agrodata
agrodata collect --dry-run

# Frontend
cd src/frontend
npm run lint && npm run test && npm run build
```

## Antes de concluir uma mudança

1. Rodar os testes do módulo alterado.
2. Atualizar docs (`README.md`, `docs/`, ADR se mudar contrato).
3. Não introduzir dependência pesada sem justificar no PR.
