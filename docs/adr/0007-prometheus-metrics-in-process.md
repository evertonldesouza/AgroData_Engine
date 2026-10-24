# ADR 0007 — Métricas Prometheus em processo, sem OpenTelemetry

- **Status:** aceito
- **Data:** 2026-10-24

## Contexto

O serviço responde perguntas de operação que hoje ninguém consegue responder sem abrir o
log: qual rota está lenta, qual a taxa de erro 5xx, quantas requisições estão em voo. O
roadmap previa "painel de observabilidade (OpenTelemetry → Grafana)", mas não existe
coletor, nem Grafana, nem orçamento para manter um nesta fase — e uma instrumentação
OpenTelemetry sem *backend* só troca `Console.WriteLine` por uma dependência maior.

## Decisão

Expor `GET /metrics` no **formato de texto do Prometheus**, gerado por uma classe própria
(`RequestMetrics`) alimentada por um middleware:

- `agrodata_http_requests_in_flight` (gauge)
- `agrodata_http_requests_total{method,route,status}` (counter)
- `agrodata_http_request_duration_seconds_{bucket,sum,count}` (histogram, 11 buckets)

Além disso, toda resposta carrega `X-Response-Time-Ms`.

## Justificativa

- **Zero dependências novas.** O formato de texto do Prometheus é estável e trivial; um
  exporter OTel adicionaria pacotes, configuração e um protocolo que ninguém vai consumir
  agora.
- **O formato é o contrato.** Quando existir um coletor (Grafana Agent, Alloy, VictoriaMetrics),
  ele já sabe ler este endpoint — a migração para OTel, se acontecer, não muda quem consome.
- **Cardinalidade controlada por construção.** Os labels usam o *template* da rota
  (`/api/commodities/{id}`) e nunca o caminho cru; caso contrário, cada id visitado criaria
  uma série nova e derrubaria o Prometheus.
- **`X-Response-Time-Ms` resolve o caso mais comum** ("essa requisição foi lenta?") sem
  ninguém precisar consultar métrica nenhuma.

## Consequências

**Positivas**

- Latência p95, taxa de erro e rotas quentes ficam observáveis com `curl /metrics`.
- O middleware é o único ponto de instrumentação: novos controllers são medidos de graça.
- O endpoint é testável sem infraestrutura (`RequestMetricsTests` verifica o texto gerado).

**Negativas / limites**

- Métricas **por instância**: com N réplicas, é preciso somar N séries no coletor (o que é o
  comportamento normal do Prometheus e está documentado).
- Contadores vivem em memória e zeram no restart — correto para counters Prometheus
  (`rate()` lida com isso), errado para faturamento.
- `/metrics` é público como o resto da API; em produção deve ser filtrado no proxy.
- Sem *exemplars*, *traces* ou correlação distribuída: quando isso for necessário, a decisão
  volta à mesa com um coletor real.

## Alternativas descartadas

- **OpenTelemetry SDK + OTLP:** correto a médio prazo, prematuro hoje (nenhum backend para
  receber os dados).
- **`prometheus-net`:** maduro, mas entrega o mesmo resultado com um pacote e uma API que
  escondem o formato que queremos justamente documentar.
- **Só log estruturado:** não responde "quantas requisições estão em voo" nem permite
  agregação barata por rota e status.
