# CI/CD

Como o projeto é construído, verificado e publicado. Cada workflow tem um dono
claro e um gate explícito: **se um workflow não reprova nada, ele não é gate**.

## Mapa dos workflows

| Workflow | Gatilho | Jobs (gate) | Publica |
| --- | --- | --- | --- |
| `ci-backend.yml` | push/PR que toca `src/backend/**` | `Build, test and coverage` (restore → build → test), `Build container image` (Dockerfile) | artefato `backend-test-results` (`.trx` + cobertura, 7 dias) |
| `ci-frontend.yml` | `src/frontend/**` | `Lint, test and build` (`eslint` → `vitest` → `vite build`) | artefato `frontend-dist` |
| `ci-data-engine.yml` | `src/data-engine/**` | `Lint, types and tests` (`ruff check` → `ruff format --check` → `mypy` → `pytest` com gate de 80%) | — |
| `ci-docs.yml` | `**/*.md`, `docs/**`, `scripts/check_docs.py` | `Validar documentação` (links, índice, ADRs, cercas) + aviso de documentação ausente | — |
| `security.yml` | push/PR + **semanal** (segunda 06:00 UTC) | `CodeQL (csharp/js-ts/python)`, `Dependency audit` | resultados no GitHub Security |
| `cd-frontend.yml` | push em `main` que toca `src/frontend/**` | `Build and publish` | branch `gh-pages` (GitHub Pages) |
| `data-pipeline.yml` | cron horário + `workflow_dispatch` | `Collect & persist` | banco (via `secrets.DATABASE_URL`) + step summary |

## Padrões aplicados em todo workflow

Adotados de forma uniforme — se for criar um workflow novo, siga a lista:

- **Path filter**: o workflow só roda quando a pasta dele muda (economiza runner e
  mantém o sinal alto).
- **`concurrency` com `cancel-in-progress`**: push novo cancela o run anterior da
  mesma branch (exceto deploy e ingestão, que usam `cancel-in-progress: false`).
- **`timeout-minutes`** em todo job: run travado não consome a cota do mês.
- **`set -o pipefail`** em qualquer step com `| tee`: sem isso o exit code do
  `dotnet test` é mascarado pelo `tee` (já aconteceu, ver [`testes.md`](./testes.md#anti-padrões-já-encontrados-neste-projeto)).
- **Diagnóstico no `$GITHUB_STEP_SUMMARY`**: falha de restore/build/teste publica
  as linhas relevantes no resumo do job e emite `::error` (anotação no PR), porque
  o log completo nem sempre abre.
- **Cache de dependências** (`actions/cache` para NuGet, `setup-node`/`setup-python`
  com `cache` keyed no lockfile/pyproject).
- **Versões de actions fixadas** (`@v4`, `@v6`); atualização vem pelo Dependabot.
- **Mínimo privilégio**: `permissions: contents: read` por padrão; `contents:
  write` só no deploy; `security-events: write` só no CodeQL.

## Gates e required checks

Um PR para `main` deve passar em:

```text
Build, test and coverage      (backend)
Build container image         (backend)
Lint, test and build          (frontend)
Lint, types and tests         (data engine)
Validar documentação          (docs)
CodeQL (csharp) · (javascript-typescript) · (python)
Dependency audit
```

CodeRabbit é revisão assistida, não gate.

**Configuração recomendada** (Settings → Branches → proteção de `main`):

- *Require status checks to pass* com a lista acima;
- *Require branches to be up to date before merging*;
- *Do not allow force pushes* e *do not allow deletions*;
- *Require linear history* (combina com o squash merge).

Isso não é controlado por arquivo no repositório e por isso está escrito aqui:
sem essa configuração, qualquer push direto em `main` fura todos os gates.

## Merge e release

- **Squash merge** sempre: o título do PR vira o assunto do commit e a `main`
  fica linear (sem commits de merge, sem nome de branch no histórico).
- **Branch de origem é apagada** após o merge; o PR é o registro da discussão.
- **Versão**: um único número por release, sincronizado em três arquivos —
  [`src/frontend/package.json`](../src/frontend/package.json),
  [`src/data-engine/pyproject.toml`](../src/data-engine/pyproject.toml) e
  `src/data-engine/agrodata/__init__.py` (fallback). O dashboard exibe a versão
  do `package.json` injetada no build (`__APP_VERSION__`), então não existe
  número escrito à mão na UI.
- **CHANGELOG**: nova seção `## [x.y.z] — data` com Adicionado / Alterado /
  Corrigido / Segurança. É o único lugar que guarda a história; o README guarda o
  presente.
- **Tag**: opcional, criada a partir do commit de release na `main`
  (`git tag -a v3.2.0 -m "..."` e `git push origin v3.2.0`).

Passo a passo de uma release:

```bash
# 1. versão em três lugares + entrada no CHANGELOG
# 2. PR "chore(release): 3.2.0" → checks verdes → squash merge
# 3. tag (opcional)
git fetch origin main && git checkout main && git pull
git tag -a v3.2.0 -m "AgroData Engine 3.2.0"
git push origin v3.2.0
```

## Deploy

| Alvo | Como | Verificação |
| --- | --- | --- |
| API | Render, a partir do `Dockerfile`, `autoDeploy` na `main`, health check `/health/ready` | `/health/ready` responde `healthy` |
| Dashboard | `cd-frontend.yml` publica `dist/` na branch `gh-pages` (Pages configurado para servir dela) | `Deploy · Frontend` verde + página abrindo |
| Dados | `data-pipeline.yml` roda de hora em hora | step summary com `inserted/skipped/errors` |

`VITE_API_URL` vem da **repository variable** `API_BASE_URL` (com fallback para o
Render), então trocar o host da API não exige commit.

## Rollback

| Situação | Ação |
| --- | --- |
| Commit ruim na `main` | `gh pr revert`/`git revert` do squash commit → PR de revert passa pelos mesmos gates |
| Deploy da API quebrado | Render → *Deploys* → *Redeploy* do commit anterior |
| Dashboard quebrado | reverter o commit em `main`; `cd-frontend.yml` republica a `gh-pages` |
| Ingestão falhando | `workflow_dispatch` com `dry_run=true` para diagnosticar; corrigir e rodar de novo |

## Como adicionar um workflow novo

1. Nome no padrão `CI · <Módulo>` / `CD · <Alvo>` / `<Domínio> · <Tarefa>`.
2. Copiar o esqueleto: `permissions` mínimo, `concurrency`, `timeout-minutes`,
   path filter.
3. Se for gate de PR, adicionar à lista de required checks acima **e** à
   proteção de branch no GitHub.
4. Documentar a linha na tabela deste arquivo e, se mudar o fluxo de release, no
   `CONTRIBUTING.md`.
5. Testar em PR antes de confiar: workflow novo que nunca falhou não é gate.
