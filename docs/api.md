# API

Base URL local: `http://localhost:5072`
Produção: `https://agro-data-engine.onrender.com`
Documentação interativa: `/swagger`

Todos os endpoints são **somente leitura** e retornam `application/json`
(compressão `gzip`/`br` quando o cliente aceita), com suporte a **requisições
condicionais** (`ETag` + `304`) e latência de servidor no header
`X-Response-Time-Ms`.

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

## `GET /api/commodities/export`

Baixa a série histórica de um símbolo como CSV (`Content-Disposition: attachment`).

| Query | Tipo | Padrão | Limite |
| --- | --- | --- | --- |
| `symbol` | string | — (obrigatório) | insensível a caixa |
| `points` | int | 500 | 1–500 |

```csv
timestamp,symbol,price
2026-10-22T12:00:00Z,SOJA,134.21
2026-10-22T13:00:00Z,SOJA,136.42
```

Decisões de formato, para o arquivo abrir igual em qualquer lugar:

- **ponto como separador decimal** (`136.42`, nunca `136,42`), independente da cultura
  do servidor — planilhas em pt-BR e `pandas.read_csv` leem sem ajuste;
- **timestamps ISO 8601 em UTC**, para não existir ambiguidade de fuso;
- `LF` como fim de linha e cabeçalho fixo, o que torna o arquivo concatenável.

`400` quando `symbol` não é informado, `404` quando o símbolo não existe.

## `GET /api/alerts`

Movimentos de preço que cruzaram o limite configurado (`Alerts:ThresholdPercent`,
padrão **1,5%**). Ordenados por severidade e, dentro dela, pela magnitude da variação.

```json
[
  {
    "symbol": "SOJA",
    "kind": "priceSpike",
    "severity": "critical",
    "price": 140.0,
    "referencePrice": 135.0,
    "changePercent": 3.7,
    "timestamp": "2026-10-22T10:00:00Z",
    "message": "SOJA subiu 3.70% (135.00 → 140.00)."
  }
]
```

| Campo | Tipo | Notas |
| --- | --- | --- |
| `kind` | `"priceSpike"` \| `"priceDrop"` | direção do movimento |
| `severity` | `"info"` \| `"warning"` \| `"critical"` | `critical` acima de `Alerts:SeverePercent` (padrão 3%) |
| `changePercent` | number | variação com sinal, 2 casas decimais |
| `referencePrice` | number | preço anterior usado na comparação |

`[]` com status `200` significa **nada acima do limite** — é a resposta saudável, não um erro.
Os alertas são calculados sob demanda a partir do snapshot (sem tabela nova): a regra é
"quanto a última cotação andou", que o próprio snapshot já responde.
Resposta cacheável por 15 s (`Cache-Control: public, max-age=15`).

## Cache HTTP e requisições condicionais

`GET /api/commodities` e `GET /api/commodities/history` publicam validadores:

```http
HTTP/1.1 200 OK
ETag: "9f3c1a0b7d2e4411-2"
Last-Modified: Thu, 22 Oct 2026 10:00:00 GMT
Cache-Control: public, max-age=20, stale-while-revalidate=40
```

- o `ETag` é derivado do **conteúdo** (símbolo, preço, timestamp e fonte — no histórico
  também a média móvel), não de um contador: duas instâncias atrás de um load balancer
  produzem o mesmo valor e um restart não invalida o cache dos clientes;
- `Last-Modified` é o timestamp da cotação mais recente da resposta;
- `max-age` vem de `Caching:SnapshotSeconds` (20 s) e `Caching:HistorySeconds` (60 s);
- `stale-while-revalidate` é o dobro do `max-age`.

Reenviando o validador, a resposta é sem corpo:

```http
GET /api/commodities
If-None-Match: "9f3c1a0b7d2e4411-2"

HTTP/1.1 304 Not Modified
ETag: "9f3c1a0b7d2e4411-2"
```

Tags fracas (`W/"..."`) e `*` também são aceitas. Com `Caching:Enabled=false` o servidor
para de reaproveitar as consultas e responde `Cache-Control: public, max-age=0, must-revalidate`
(mantendo o `ETag`, para o cliente ainda poder validar).

## Métricas (`GET /metrics`)

Exposição no formato de texto do Prometheus (`text/plain; version=0.0.4`):

```text
# TYPE agrodata_http_requests_in_flight gauge
agrodata_http_requests_in_flight 0
# TYPE agrodata_http_requests_total counter
agrodata_http_requests_total{method="GET",route="api/commodities",status="200"} 42
# TYPE agrodata_http_request_duration_seconds histogram
agrodata_http_request_duration_seconds_bucket{method="GET",route="api/commodities",status="200",le="0.05"} 40
agrodata_http_request_duration_seconds_bucket{method="GET",route="api/commodities",status="200",le="+Inf"} 42
agrodata_http_request_duration_seconds_sum{method="GET",route="api/commodities",status="200"} 0.61
agrodata_http_request_duration_seconds_count{method="GET",route="api/commodities",status="200"} 42
```

- os labels usam o **template** da rota (`/api/commodities/{id}`), nunca o caminho cru,
  então ids não criam séries novas;
- requisições que não casaram com nenhuma rota aparecem como `route="unmatched"`;
- buckets de latência: 5 ms, 10, 25, 50, 100, 250, 500 ms, 1, 2.5, 5, 10 s e `+Inf`;
- toda resposta carrega `X-Response-Time-Ms` (tempo de servidor, em ms).

O endpoint é público como o resto da API; em produção, restrinja-o no proxy/reverse
proxy se as métricas não devem ser expostas.

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
| `304` | `If-None-Match` corresponde ao `ETag` atual (sem corpo) |
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
