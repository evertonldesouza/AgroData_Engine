# ADR 0005 — Polling com backoff em vez de WebSocket

- **Status:** aceito
- **Data:** 2026-10

## Contexto

Os preços mudam uma vez por hora (cron). O dashboard precisa parecer vivo, mas não
há fluxo contínuo de eventos — um WebSocket seria um canal ocioso 99% do tempo,
além de exigir infraestrutura com estado (sticky sessions, reconexão, broadcast) e
compatibilidade com o plano gratuito do Render.

## Decisão

- Polling de 15 s no snapshot (`/api/commodities`).
- Polling de 60 s no histórico (`/api/commodities/history`), que muda ainda menos.
- Backoff exponencial em caso de erro: 15 s → 30 s → 60 s → 120 s (teto).
- Pausa quando a aba está oculta (`visibilitychange`) e refetch ao voltar.
- `AbortController` cancela a requisição anterior a cada ciclo.

## Consequências

- **Positivo:** carga previsível (≈ 4 req/min por cliente) e compatível com qualquer host
  estático (GitHub Pages) e com o free tier do Render.
- **Positivo:** código de ~80 linhas, sem biblioteca de estado.
- **Negativo:** latência de até 15 s para refletir uma cotação nova.
- **Gatilho de revisão:** se a ingestão passar a ser por minuto (ou em tempo real), migrar
  para SSE — mantendo o mesmo hook de dados e trocando apenas o transporte.
