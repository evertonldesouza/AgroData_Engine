# Frontend — AgroData Dashboard

SPA em React 19 + Vite que consome a API .NET.

## Rodando

```bash
npm install
npm run dev     # http://localhost:5173
```

O dev server faz proxy de `/api` e `/health` para `http://localhost:5072`
(override com `VITE_PROXY_TARGET`). Em produção, defina `VITE_API_URL` com a URL da API.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_API_URL` | *(vazio)* | URL absoluta da API; vazio = requisições relativas |
| `VITE_BASE` | `/AgroData_Engine/` | caminho público do build (GitHub Pages) |
| `VITE_PROXY_TARGET` | `http://localhost:5072` | destino do proxy no dev |
| `VITE_ALLOWED_HOSTS` | *(vazio)* | hosts extra permitidos no dev server (túneis) |

## Estrutura

```text
src/
├── api/          # client (timeout/abort/erros) + endpoints
├── hooks/        # useCommodities (polling) · usePriceHistory (série) · useAlerts
├── lib/          # format, normalize, series, symbols, alerts
├── components/   # Header, TickerCard, MarketChart, HistoryTable, AlertPanel, ExportCsvLink, ...
└── App.jsx       # composição e estados de tela
```

## Decisões de UI

- **Dados reais**: o gráfico usa `/api/commodities/history`; nada é "inventado" a partir
  do polling.
- **Resiliência**: backoff exponencial (15s → 120s), pausa em aba oculta, cancelamento via
  `AbortController` e `ErrorBoundary` no topo da árvore.
- **Alertas visíveis**: painel com severidade (crítico/atenção/info) e badge no header; falha
  na consulta de alertas degrada em silêncio, porque é um sinal secundário.
- **Exportação direta**: o botão de CSV aponta para `/api/commodities/export`; o download é
  feito pelo navegador (`Content-Disposition: attachment`), sem carregar o arquivo em memória.
- **Compatibilidade**: `lib/normalize.js` aceita o contrato atual e o legado
  (`Alta`/`Baixa`/`Estável`), permitindo deploy independente da API.
- **Performance**: Recharts é carregado sob demanda; bundle inicial ~74 kB gzip.
- **Acessibilidade**: `aria-live` no status, tabela com `<th scope>`, foco visível e
  respeito a `prefers-reduced-motion`.

## Qualidade

```bash
npm run lint
npm run test          # 87 testes (Vitest)
npm run test:coverage # 98% de linhas em lib/ e api/
npm run screenshot    # captura o dashboard (Playwright, instalado sob demanda)
npm run build
```
