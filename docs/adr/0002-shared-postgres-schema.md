# ADR 0002 — Um schema PostgreSQL compartilhado por Python e .NET

- **Status:** aceito
- **Data:** 2026-10

## Contexto

Dois runtimes escrevem/lem o mesmo dado: o data engine (Python/SQLAlchemy) insere
cotações; a API (.NET/EF Core) lê. As opções eram (a) a API chamar um endpoint interno
do Python, (b) um broker/stream, ou (c) compartilhar o banco.

## Decisão

Compartilhar a tabela `Commodities`, com nomes PascalCase, e tratar o **schema como
contrato público**:

- `src/data-engine/agrodata/models.py` e
  `src/backend/AgroData.Infrastructure/Context/Configurations/CommodityConfiguration.cs`
  declaram a mesma tabela.
- As migrations EF Core são a fonte de verdade do schema; o Python só cria tabelas
  inexistentes em ambiente local (`agrodata init-db`).
- O `Source` registra a origem (`Simulated Market Data`, provedor HTTP) para auditoria.

## Consequências

- **Positivo:** acoplamento mínimo em tempo de execução; o pipeline pode rodar enquanto a
  API está no ar (e vice-versa).
- **Positivo:** nenhum serviço precisa estar "acordado" para o outro funcionar — importante
  no plano gratuito do Render.
- **Negativo:** alterações de schema exigem coordenação. Mitigado por migrações versionadas
  e pelos dois modelos comentados apontando um para o outro.
- **Negativo:** não há validação cruzada automática entre os modelos. O teste de integração
  `CommoditiesEndpointTests` cobre o contrato de leitura real.
