# Regras do Projeto

## Stack
- Backend: .NET 10, C#, EF Core + Npgsql
- Frontend: React (JSX)
- Scripts: Python 3.12
- Banco: PostgreSQL (Supabase)
- Infra: GitHub Actions, Render

## Convenções
- Nomes de classes/métodos em PascalCase
- Nomes de variáveis locais em camelCase
- Endpoints REST no plural (`/api/commodities`)
- Async/await com sufixo `Async`
- Testes em xUnit com Moq
- CORS restrito via `FRONTEND_URL`

## Comandos
```bash
# Testes backend
dotnet test src/backend/AgroData.Tests

# Rodar API local
dotnet run --project src/backend/AgroData.API

# Pipeline Python
python src/scripts/main_pipeline.py
```
