# Architecture Decision Records

Registro curto das decisões que moldaram o projeto. Cada ADR descreve contexto,
decisão e consequências — inclusive as negativas.

| # | Decisão | Status |
| --- | --- | --- |
| [0001](./0001-clean-architecture.md) | Quatro camadas com dependências apontando para dentro | aceito |
| [0002](./0002-shared-postgres-schema.md) | Um schema PostgreSQL compartilhado por Python e .NET | aceito |
| [0003](./0003-per-symbol-queries.md) | Uma consulta por símbolo em vez de window function | aceito |
| [0004](./0004-public-read-only-api.md) | API pública somente leitura, sem JWT | aceito |
| [0005](./0005-polling-over-websockets.md) | Polling com backoff em vez de WebSocket | aceito |
| [0006](./0006-http-caching-and-conditional-get.md) | Cache em processo + `ETag`/`304` nos endpoints de leitura | aceito |
| [0007](./0007-prometheus-metrics-in-process.md) | Métricas Prometheus em processo, sem OpenTelemetry | aceito |

Formato baseado em [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).
Ao propor uma mudança estrutural, adicione `0008-....md` e atualize esta tabela.
