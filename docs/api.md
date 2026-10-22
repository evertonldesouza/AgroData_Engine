# API

Base URL local: `http://localhost:5072`
Produção: `https://agro-data-engine.onrender.com`
Documentação interativa: `/swagger`

Todos os endpoints são **somente leitura** e retornam `application/json`
(compressão `gzip`/`br` quando o cliente aceita).

## `GET /api/commodities`

Snapshot mais recente de cada commodity, ordenado por símbolo.

```json
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

| Campo | Tipo | Notas |
| --- | --- | --- |
| `price` | number | BRL por saca de 60 kg, 2 casas decimais |
| `previousPrice` | number \| null | `null` quando existe apenas uma cotação |
| `delta` | number \| null | variação absoluta entre as duas últimas cotações |
| `deltaPercent` | number \| null | variação relativa em % |
| `trend` | `"up"` \| `"down"` \| `"flat"` | serializado em camelCase |
| `history` | number[] | até 24 preços, do mais antigo ao mais recente |

Retorna `[]` (200) quando o warehouse está vazio.

## `GET /api/commodities/history`

Série histórica de um símbolo, com média móvel.

| Query | Tipo | Padrão | Limite |
| --- | --- | --- | --- |
| `symbol` | string | — (obrigatório) | insensível a caixa |
| `points` | int | 30 | 1–500 (valores fora da faixa são limitados) |

```json
{
  "symbol": "SOJA",
  "points": [
    { "timestamp": "2026-10-22T12:00:00Z", "price": 134.21 },
    { "timestamp": "2026-10-22T13:00:00Z", "price": 136.42 }
  ],
  "movingAverage": 135.74,
  "window": 7
}
```

`movingAverage` é `null` quando há menos de 3 pontos.

## `GET /api/commodities/{id}`

Cotação individual. `404` quando o `id` não existe.

## Health checks

| Rota | Uso | Toca o banco? |
| --- | --- | --- |
| `/health` | status agregado (dashboard/uptime) | sim |
| `/health/live` | liveness (processo de pé) | não |
| `/health/ready` | readiness (dependências OK) | sim |

```json
{
  "status": "healthy",
  "totalDurationMs": 4,
  "checks": [
    {
      "name": "postgresql",
      "status": "healthy",
      "description": "PostgreSQL is reachable.",
      "durationMs": 3
    }
  ]
}
```

## Erros

Formato [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (`application/problem+json`):

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Quote not found",
  "status": 404,
  "detail": "No quote exists with id 999999.",
  "instance": "/api/commodities/999999"
}
```

| Status | Quando |
| --- | --- |
| `400` | parâmetro obrigatório ausente (`symbol`) |
| `404` | cotação ou símbolo inexistente |
| `429` | mais de 120 requisições por minuto pelo mesmo IP |
| `500` | erro inesperado — inclui `traceId` para correlação nos logs |

## Versionamento

A API é versionada em nível de repositório (v3.0.0 na raiz). Mudanças incompatíveis
entram em um novo prefixo (`/api/v2/...`) e o dashboard mantém um normalizador que
aceita o contrato anterior (`Alta`/`Baixa`/`Estável`) durante a transição — veja
`src/frontend/src/lib/normalize.js`.

## Rate limiting

Limite fixo de **120 requisições por minuto por IP**, com `429` em caso de excesso.
O dashboard consulta a cada 15 s, muito abaixo do limite.
