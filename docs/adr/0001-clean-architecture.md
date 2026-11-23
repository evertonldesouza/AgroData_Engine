# ADR 0001 — Quatro camadas com dependências apontando para dentro

- **Status:** aceito
- **Data:** 2026-10

## Contexto

O backend começou como um único projeto ASP.NET com controllers acessando o
`DbContext` diretamente. Isso funcionava para dois endpoints, mas dificultava testar
regras de preço (era necessário um banco) e misturava HTTP com SQL.

## Decisão

Dividir em quatro projetos:

```text
API ─▶ Application ─▶ Domain
 │           ▲
 └─▶ Infrastructure ─┘
```

- `Domain` não referencia nada: entidades, enum de tendência e contratos de repositório.
- `Application` contém use cases e regras puras (`TrendCalculator`), sem EF Core.
- `Infrastructure` implementa os contratos com EF Core + Npgsql.
- `API` compõe tudo e trata HTTP (Problem Details, CORS, rate limit, Swagger).

O `Domain` não é uma pasta: é o único projeto que nenhum outro contém dependências de
terceiros, o que mantém as regras de negócio estáveis.

## Consequências

- **Positivo:** regras de preço testadas com `[Theory]` sem banco; repositório mockável;
  troca de banco isolada em um projeto.
- **Positivo:** os testes de integração usam SQLite trocando apenas o `DbContext`.
- **Negativo:** mais projetos e um `Directory.Build.props` para manter as configurações
  alinhadas.
- **Negativo:** uma consulta simples atravessa três arquivos — aceitável pelo ganho de
  testabilidade e pela clareza de responsabilidades.
