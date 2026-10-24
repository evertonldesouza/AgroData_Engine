# ADR 0006 — Cache em memória com `ETag` e requisições condicionais

- **Status:** aceito
- **Data:** 2026-10-24

## Contexto

O dashboard consulta `GET /api/commodities` a cada 15 segundos, por aba aberta. A ingestão,
porém, roda de hora em hora. Isso significa que, sem cache, cada cliente gera **240 consultas
idênticas ao PostgreSQL por hora**, e a grande maioria delas devolve exatamente o mesmo
payload — bytes, CPU e conexões gastos para reconfirmar um dado que não mudou.

Ao mesmo tempo, a API roda publicamente (Render), então o custo não é hipotético: cada novo
visitante multiplica o polling.

## Decisão

Duas camadas, deliberadamente independentes:

1. **Cache em processo** (`TtlCache<TKey, TValue>`) com TTL absoluto e *single-flight*,
   aplicado por um decorator (`CachedCommodityService`) em frente a `ICommodityService`.
   TTLs vêm de configuração: 20 s para o snapshot, 60 s para o histórico.
2. **Cache HTTP** com `ETag` forte derivado do conteúdo, `Last-Modified` e `Cache-Control`,
   respondendo `304 Not Modified` quando o `If-None-Match` confere.

## Justificativa

- **Decorator, não código no serviço.** As regras de negócio continuam ignorando que existe
  cache; desligar (`Caching:Enabled=false`) não altera o caminho que importa.
- **`ETag` derivado do conteúdo.** Um contador interno seria mais simples, mas duas
  instâncias atrás de um load balancer discordariam dele e cada restart invalidaria o cache
  de todos os clientes. O hash FNV-1a sobre símbolo/preço/timestamp/fonte custa nanossegundos
  e é estável entre processos.
- **`single-flight`.** Quando a entrada expira e 10 requisições chegam juntas, uma consulta o
  banco e as outras 9 esperam o mesmo resultado — sem *cache stampede*.
- **`stale-while-revalidate` = 2× `max-age`.** O cliente pode mostrar o dado levemente velho
  enquanto busca o novo, o que elimina o "pisca" de carregamento no dashboard.

## Consequências

**Positivas**

- Uma cotação recém-ingerida aparece em ≤ 20 s (snapshot) e ≤ 60 s (histórico).
- O número de consultas ao banco cai de 240/hora por cliente para ~180/hora **no total**,
  independente de quantas abas estejam abertas.
- O `304` economiza banda: o corpo só trafega quando o dado realmente mudou.

**Negativas / limites**

- Cache **em processo**: com N réplicas, cada uma mantém a sua cópia (consistência eventual
  de até 20 s entre instâncias). Aceitável para preços horários; inaceitável para saldo.
- Sem invalidação ativa: um `POST` futuro precisaria chamar `Invalidate` ou usar um cache
  distribuído (Redis), que fica fora do escopo atual.
- Histórico é cacheado por `SÍMBOLO:pontos`; combinações novas custam uma consulta cada.

## Alternativas descartadas

- **Redis / `IMemoryCache` do ASP.NET:** o segundo traria TTL mas não *single-flight* nem
  controle de relógio nos testes; o primeiro adiciona um serviço externo para resolver um
  problema de 20 segundos.
- **Só `Cache-Control` (sem `ETag`):** o navegador evita a requisição por 20 s, mas depois
  ainda baixa o payload inteiro. O validador resolve o caso "mudou ou não mudou" de graça.
- **`ETag` fraco (`W/`):** indicaria semântica de equivalência que não queremos prometer;
  o payload é byte-idêntico quando o hash confere, então o tag forte é honesto.
