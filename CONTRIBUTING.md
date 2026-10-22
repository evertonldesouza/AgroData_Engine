# Contribuindo

Obrigado pelo interesse! Este é um projeto de portfólio, mas segue um fluxo de
contribuição real.

## Fluxo

1. Abra uma issue descrevendo o problema (use o template).
2. Crie a branch a partir de `main`: `feat/descricao-curta` ou `fix/descricao-curta`.
3. Faça commits pequenos seguindo [Conventional Commits](https://www.conventionalcommits.org/).
4. Garanta que os três conjuntos de testes passam.
5. Abra o PR preenchendo o template (Why / What / How).

## Commits

```text
feat(api): adiciona endpoint de histórico por símbolo
fix(engine): isola falha de coleta por símbolo
chore(ci): separa workflows por domínio
docs(adr): registra decisão sobre polling
test(frontend): cobre normalização do payload legado
```

Escopos usados: `api`, `app`, `infra`, `engine`, `web`, `ci`, `docs`, `adr`.

## Antes de abrir o PR

```bash
# Backend
dotnet build src/backend/AgroData.slnx -c Release
dotnet test src/backend/AgroData.Tests

# Data engine
cd src/data-engine
ruff check . && ruff format --check . && mypy agrodata && pytest

# Frontend
cd src/frontend
npm run lint && npm run test && npm run build
```

## Padrões

- C#: nomes em PascalCase, `async` com sufixo `Async`, cancelamento propagado,
  `AsNoTracking` em leitura, XML docs em APIs públicas.
- Python: tipagem completa (`mypy --strict`), funções puras quando possível,
  logging estruturado em vez de `print`.
- React: componentes funcionais, lógica pura em `src/lib` (testada), hooks para
  efeitos colaterais, acessibilidade obrigatória (roles, `aria-*`, foco visível).
- Sem segredos no código: use `.env` local e secrets do GitHub Actions.

## Mudanças de arquitetura

Proposta que altere contratos entre módulos deve vir com um ADR em `docs/adr/` e
a atualização da tabela em `docs/adr/README.md`.
