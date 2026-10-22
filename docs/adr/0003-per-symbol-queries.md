# ADR 0003 — Uma consulta por símbolo em vez de window function

- **Status:** aceito
- **Data:** 2026-10

## Contexto

O dashboard precisa das **últimas N cotações de cada símbolo**. A forma canônica em
PostgreSQL é `ROW_NUMBER() OVER (PARTITION BY "Symbol" ORDER BY "Timestamp" DESC)`,
que resolve tudo em uma única query.

O problema: os testes de integração usam SQLite, e SQL bruto com dialeto específico
quebra a portabilidade. A alternativa "pega as 20 linhas mais recentes e agrupa em
memória" tem um defeito real: um símbolo com muitos registros pode expulsar outro
símbolo do resultado — foi exatamente esse o bug corrigido nesta refatoração.

## Decisão

1. Buscar a lista de símbolos distintos (índice `IX_Commodities_Symbol`).
2. Para cada símbolo, executar uma consulta `Take(N)` ordenada por
   `Timestamp DESC, Id DESC` (índice composto `IX_Commodities_Symbol_Timestamp`).
3. Limitar a **32 símbolos**, para que o número de idas ao banco seja previsível.

## Consequências

- **Positivo:** cada símbolo contribui com as próprias N cotações, sempre.
- **Positivo:** mesmo SQL gerado pelo EF Core em PostgreSQL e SQLite (testes reais, não
  provider in-memory).
- **Negativo:** N+1 consultas — com 2–10 commodities e índice composto, o custo é
  irrelevante (poucos milissegundos). Se o número de símbolos crescer para centenas,
  a decisão deve ser revisitada com uma window function específica por dialeto.
- **Mitigação:** o teste `GetRecentAsync_does_not_let_a_busy_symbol_starve_another`
  garante o comportamento contra 50 registros de um único símbolo.
