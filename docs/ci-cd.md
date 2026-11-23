# CI/CD

Como o projeto é construído, verificado e publicado. Cada workflow tem um dono
claro e um gate explícito: **se um workflow não reprova nada, ele não é gate**.

## Mapa dos workflows

| Workflow | Gatilho | Jobs (gate) | Publica |
| --- | --- | --- | --- |
| `ci-backend.yml` | push em `main` com `src/backend/**`; **todo PR** | `Build, test and coverage` (restore → build → test), `Build container image` (Dockerfile) | artefato `backend-test-results` (`.trx` + cobertura, 7 dias) |
| `ci-frontend.yml` | push em `main` com `src/frontend/**`; **todo PR** | `Lint, test and build` (`eslint` → `vitest` → `vite build`) | artefato `frontend-dist` |
| `ci-data-engine.yml` | push em `main` com `src/data-engine/**`; **todo PR** | `Lint, types and tests` (`ruff check` → `ruff format --check` → `mypy` → `pytest` com gate de 80%) | — |
| `ci-docs.yml` | push em `main` com markdown/docs; **todo PR** | `Validar documentação` (links, índice, ADRs, cercas) + aviso de documentação ausente | — |
| `security.yml` | push/PR + **semanal** (segunda 06:00 UTC) | `CodeQL (csharp/js-ts/python)`, `Dependency audit` | resultados no GitHub Security |
| `identity-guard.yml` | push em `main` + **todo PR** | `Guard · identidade` (autor, committer e trailer de coautoria) | — |
| `cd-frontend.yml` | push em `main` que toca `src/frontend/**` | `Build and publish` | branch `gh-pages` (GitHub Pages) |
| `data-pipeline.yml` | cron horário + `workflow_dispatch` | `Collect & persist` | banco (via `secrets.DATABASE_URL`) + step summary |

## Padrões aplicados em todo workflow

Adotados de forma uniforme — se for criar um workflow novo, siga a lista:

- **Path filter só em `push`**: no `pull_request` o filtro é proibido. O GitHub
  exige que **todo check obrigatório reporte uma conclusão** em cada PR; quando o
  filtro de caminho impede o workflow de rodar, o check fica
  `Expected — waiting for status to be reported` para sempre e o PR nunca entra
  (sem que nada pareça errado no código). O filtro continua no `push` em `main`,
  onde de fato economiza runner.
- **`merge_group`** declarado nos workflows que são required checks: sem ele a
  merge queue nunca consegue satisfazer as exigências.
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

Um PR para `main` deve passar em **dez checks**, todos mapeados para um job concreto
(o job é o que o GitHub reporta):

| Check (nome do job) | Workflow | O que reprova |
| --- | --- | --- |
| `Build, test and coverage` | `ci-backend.yml` | build, restore ou teste do backend |
| `Build container image` | `ci-backend.yml` | `Dockerfile` não constrói |
| `Lint, test and build` | `ci-frontend.yml` | `eslint`, `vitest` ou `vite build` |
| `Lint, types and tests` | `ci-data-engine.yml` | `ruff`, `ruff format`, `mypy` ou cobertura < 80% |
| `Validar documentação` | `ci-docs.yml` | link quebrado, página fora do índice, ADR sem entrada |
| `CodeQL (csharp)` | `security.yml` | achado de segurança no C# |
| `CodeQL (javascript-typescript)` | `security.yml` | achado no frontend |
| `CodeQL (python)` | `security.yml` | achado no data engine |
| `Dependency audit` | `security.yml` | CVE em NuGet, npm ou pip |
| `Guard · identidade` | `identity-guard.yml` | commit assinado por ferramenta (autor, committer ou coautoria) |

O check `CodeQL` (sem sufixo) é o *gate* da matriz de CodeQL no GitHub Security e
não precisa ser exigido; `CodeRabbit` é revisão assistida e **não** é gate.

### Como configurar (Settings → Rules, o único passo que não é versionável)

O repositório não guarda a proteção de branch: ela é configuração do GitHub.
Sem ela, qualquer `git push` direto na `main` ignora todos os gates acima.

1. **Settings → Rules → Rulesets → New branch ruleset** (preferido) ou
   *Settings → Branches → Add classic branch protection rule*.
2. **Target**: `main`.
3. **Enforcement**: Active.
4. Marcar:
   - *Require a pull request before merging* (0 aprovações é aceitável em projeto
     solo — o objetivo é impedir push direto);
   - *Require status checks to pass* → **Require branches to be up to date before
     merging**;
   - *Require linear history* (combina com o squash merge);
   - *Block force pushes*;
   - *Restrict deletions*.
5. Na lista de status checks, adicionar os dez nomes da tabela acima — eles só
   aparecem no seletor depois de terem rodado ao menos uma vez.

> **Pegadinha que custa horas:** se um desses workflows tiver `paths:` no
> `pull_request`, o check correspondente fica `Expected` para sempre em PRs que
> não tocam aquela pasta, e o merge fica bloqueado. É por isso que os workflows
> daqui rodam em **todo** PR e o filtro de caminho só existe no `push`.

### Conferindo que está valendo

```bash
# deve responder com a lista de checks exigidos (ou com "Not Found" se não houver)
gh api repos/{owner}/{repo}/branches/main/protection

# versão moderna (rulesets)
gh api repos/{owner}/{repo}/rulesets --jq '.[].name'

# teste real: um push direto deve ser recusado
git checkout main && git commit --allow-empty -m "test: bypass" && git push
```

O último comando **precisa falhar** com `protected branch hook declined`. Se ele
passar, a regra não está ativa.

## Identidade dos commits

O workflow `Guard · identidade` garante que nenhum commit do PR assina uma ferramenta como
autora, committer ou coautora. A defesa completa (guarda local, hook versionado, listas de
permissão e como corrigir um trailer já publicado) está em
[`identidade-e-autoria.md`](./identidade-e-autoria.md) — resumo:

```bash
python scripts/guard_identity.py install   # uma vez por clone: remove hooks injetores
python scripts/guard_identity.py check     # audita o histórico
```

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
