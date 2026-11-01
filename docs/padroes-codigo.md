# Padrões de código

Convenções que valem para os três módulos. O resumo operacional está em
[`AGENTS.md`](../AGENTS.md); este documento explica **o porquê** e cobre os casos
que o resumo não alcança.

## Princípios

1. **Regra de negócio não conhece framework.** Cálculo de preço, média móvel e
   avaliação de alerta vivem em código puro (Application/Python puro) e são
   testáveis sem banco, sem HTTP e sem relógio real.
2. **Fronteira explícita.** Cada módulo expõe um contrato pequeno: a tabela
   `Commodities` (Python → banco → .NET), a API REST (API → React) e o CSV.
3. **Falha visível e barata.** Erro esperado vira resposta documentada (`400`,
   `404`, item em `report.errors`); erro inesperado vira `500` com `traceId`,
   nunca stack trace no corpo.
4. **Sem surpresa de cultura.** Número, data e ordenação usam cultura invariante
   quando o destino é máquina (CSV, métricas, ETag) e `pt-BR` quando o destino é
   humano (dashboard).

## C# / .NET

| Assunto | Regra |
| --- | --- |
| Nomes | `PascalCase` em tipos e membros, `_camelCase` em campos privados, `Async` no sufixo de métodos assíncronos |
| Tipos | `record` para DTOs e value objects; `sealed` por padrão em classes de serviço |
| Nulos | nullable reference types ligados; `ArgumentNullException.ThrowIfNull` no construtor |
| Assíncrono | `async`/`await` sem `Task.Result`; `CancellationToken` propagado até o repositório; `.ConfigureAwait(false)` fora do controller |
| Erros | `ProblemDetails` (RFC 9457); exceção nova só para fluxo excepcional, `GlobalExceptionHandler` traduz o resto |
| Configuração | classe `*Options` + `IOptions<T>` + `ValidateDataAnnotations()` + `ValidateOnStart()` |
| DI | registro na camada que possui o contrato (`AddApplication`, `AddInfrastructure`, `AddApiServices`) |
| Documentação | XML docs em todo membro público (`GenerateDocumentationFile`); `<remarks>` para decisão, não para repetir o nome |
| Dados | `AsNoTracking` em leitura; nenhuma query fora de `Infrastructure`; migrations geradas, nunca escritas à mão |
| Cultura | `CultureInfo.InvariantCulture` em qualquer string que máquina consuma (CSV, métricas, `Cache-Control`) |

Analisadores (`Directory.Build.props`): `AnalysisLevel=latest-recommended`,
`EnableNETAnalyzers` e `WarningsAsErrors=nullable`. O resto dos avisos não quebra
o build de propósito (evita ruído de versão de SDK), então a regra é **não
acumular aviso novo**: `NoWarn` existe apenas em projeto de teste (`CA1707` para
nomes com `_`, `CA1861` para arrays em asserção, `CA2007`/`CA1515`).

Exemplo de regra pura (o padrão que se quer replicar):

```csharp
public static double? MovingAverage(IReadOnlyList<double> prices, int window)
{
    if (window <= 0 || prices.Count < window) return null;
    return prices.TakeLast(window).Average();
}
```

## Python

- **`mypy --strict`** sem exceção: `disallow_untyped_defs`, `warn_unused_ignores`.
  `# type: ignore` só com código de erro e motivo.
- **ruff** com `E,F,I,UP,B,SIM,C4,PT,RUF`, `line-length = 100`. `# noqa` só para
  regra **habilitada** — `noqa` inútil falha em `RUF100`.
- **`logging` em vez de `print`**; `print` só na CLI, onde a saída é o produto.
- **Configuração** via `pydantic-settings`, validada no start-up, com mensagem
  que diga o que fazer (`DATA_SOURCE=http requires COMMODITY_API_URL`).
- **Retry** com `tenacity` e backoff exponencial limitado, apenas em erros
  transitórios — nunca em erro de validação.
- **Nunca inventar dado.** Coletor que não encontra o valor devolve `None` e
  registra o motivo; o pipeline reporta o símbolo como erro. Um preço errado no
  warehouse é pior que um preço faltando.

## JavaScript / React

- Lógica pura em `src/lib` (testada); componente não faz cálculo pesado.
- Efeitos colaterais em hooks (`useCommodities`, `usePriceHistory`, `useAlerts`),
  com `AbortController` no cleanup e pausa quando a aba está oculta.
- Todo `fetch` passa por `src/api/client.js` (timeout, abort, erro tipado) — nunca
  `fetch` solto em componente.
- Acessibilidade obrigatória: `aria-live` em estado dinâmico, `<th scope>`,
  foco visível, `prefers-reduced-motion` respeitado.
- Normalização defensiva em `lib/normalize.js`: o dashboard pode ser publicado
  antes da API, então payload inesperado degrada, não quebra.

## SQL e schema

- Colunas em `PascalCase` porque o schema pertence ao banco, não ao ORM.
- Toda coluna usada em filtro tem índice; o histórico usa
  `IX_Commodities_Symbol_Timestamp`.
- Migrations são a fonte de verdade do schema; o Python apenas cria tabelas
  ausentes em desenvolvimento (`agrodata init-db`).

## Commits e branches

- [Conventional Commits](https://www.conventionalcommits.org/pt-BR/), escopos
  `api`, `app`, `infra`, `engine`, `web`, `ci`, `docs`, `adr`, `test`.
- Um commit (ou um PR) por assunto; mensagem diz o **porquê**, o diff diz o **quê**.
- Merge é **squash**: o título do PR vira o assunto do commit e a `main` fica
  linear — ver [`ci-cd.md`](./ci-cd.md#merge-e-release).

## O que não fazer

- Deixar cache ou retry "invisível": se existe, tem configuração, teste e linha
  na documentação.
- Adicionar dependência sem justificar no PR (peso, manutenção, alternativa da
  biblioteca padrão).
- Silenciar exceção com `catch { }` / `except Exception: pass`.
- Duplicar número (contagem de teste, versão) em três arquivos: a fonte é uma só.
