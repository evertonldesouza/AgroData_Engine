# Identidade e autoria dos commits

Este documento existe porque um problema concreto aconteceu duas vezes: um hook local em
`.git/hooks/commit-msg` injetava `Co-authored-by: arena-agent <…>` em **todo** commit, e o
trailer apareceu na `main` como se a ferramenta fosse coautora do projeto. Na segunda vez
o mesmo hook reapareceu num clone novo, depois de o histórico já ter sido limpo.

Isso é a lição central: **não se resolve limpando o histórico.** O hook é local, não é
versionado, não aparece em `git grep` e volta em cada clone. A pergunta certa não é "como
limpo este repositório?", é **"como impede isso em qualquer projeto, inclusive nos que
ainda não existem?"**. A resposta são três camadas, e a primeira é global.

## As três camadas

| Camada | Onde vive | Quando age | Pega o quê | Custo |
| --- | --- | --- | --- | --- |
| **1. Guarda global** | `~/.githooks/` + `core.hooksPath` global | em todo `git commit`, de **qualquer** repositório | hook injetor e coautoria de ferramenta | um comando, uma vez por máquina |
| **2. Hook versionado** | `.githooks/commit-msg` no repositório | em cada `git commit` daquele projeto | mensagem com coautoria de ferramenta | um comando por clone |
| **3. CI** | `Guard · identidade` (`identity-guard.yml`) | em todo PR e push na `main` | commit que escapou das camadas 1 e 2 | nada, se copiar o workflow |

Nenhuma delas altera mensagem sozinha: a regra é **reprovar**, não consertar. Mensagem
reescrita por script é o tipo de "correção" que esconde o problema.

### Camada 1 — guarda global (vale para todos os projetos)

```bash
python scripts/guard_identity.py install --global
```

O que ele faz, uma vez por máquina:

- grava `~/.githooks/commit-msg` (o hook da guarda);
- copia `guard_identity.py` para `~/.local/share/guard-identity/`;
- define `git config --global core.hooksPath ~/.githooks`.

Daí em diante, **todo** `git commit`, em **todo** repositório da conta, passa pela guarda —
inclusive projetos que nunca ouviram falar deste repositório, clonados amanhã. Um hook
injetor instalado pela ferramenta em `.git/hooks/` nunca é executado, porque o git só olha
para o `core.hooksPath`.

```bash
python scripts/guard_identity.py doctor    # a proteção está ativa aqui?
python scripts/guard_identity.py scan ~/   # audita todos os repos de uma pasta
```

Exceção que você precisa conhecer: **um repositório que define o próprio
`core.hooksPath` tem precedência sobre o global.** Nesse caso o hook global não roda.
`doctor` detecta exatamente isso e manda rodar `install` no projeto; `install` local troca
o `hooksPath` sem guarda pelo global, em vez de deixar um caminho silenciosamente inerte.

`install --global` não mexe em `~/.githooks` de quem já tem hooks próprios: ele grava
apenas `commit-msg`. Se você usa `pre-commit`/`pre-push` de outras ferramentas, mantenha-os
em `~/.githooks` — eles continuam rodando normalmente.

### Camada 2 — hook versionado (`.githooks/commit-msg`)

```bash
python scripts/guard_identity.py install
```

- move para `.git/hooks-disabled/` os hooks de mensagem (`commit-msg`,
  `prepare-commit-msg`, `pre-commit`, `pre-push`) que existirem no clone;
- aponta o `core.hooksPath` local para `.githooks/` (versionado), então hooks que a
  ferramenta instalar depois são ignorados;
- sem `.githooks/` no projeto, cai no hook global e remove o `hooksPath` local que
  atrapalharia — avisando quando não há nenhuma das duas opções;
- imprime `user.name`/`user.email` do clone para você conferir que é a sua identidade.

O hook só reprova: não adiciona, não remove, não formata. Se `python` não existir na
máquina, ele avisa e deixa passar — falha de infraestrutura não pode bloquear trabalho.

Coautoria legítima (outra pessoa) existe por decisão registrada em
[`.github/identity-allowlist.txt`](../.github/identity-allowlist.txt) — arquivo
versionado, revisado no PR como qualquer código.

### Camada 3 — CI (`Guard · identidade`)

O workflow roda `guard_identity.py` e falha o PR quando encontra:

- **autor ou committer** casando com a denylist (ferramenta assinando o commit inteiro);
- **trailer** de coautoria de ferramenta;
- **trailer** de coautoria que não está na allowlist.

Em PR, audita `origin/main..HEAD` (o que o PR acrescenta); em push na `main`, audita todas
as branches mais o commit que acabou de entrar. Isso evita que um commit antigo, já
revisado e publicado, bloqueie trabalho novo.

O que fica **fora** da varredura da `main`: commits vivos apenas em branches remotas
paradas (um PR de dependabot aberto antes de uma reescrita, por exemplo). Eles são julgados
no check **do PR** dessas branches, via `origin/main..HEAD` — que é o momento em que esse
conteúdo pode entrar. Sem essa separação, um commit antigo de branch abandonada derruba
para sempre o check da `main`.

**Só a cauda da mensagem conta como trailer.** O git reconhece trailer apenas no bloco
final, com uma linha `Chave: valor` por linha e nada de prosa depois. A guarda usa a mesma
regra: um corpo que *explica* o problema ("o PR anterior tinha um `Co-authored-by: ...`")
passa; um trailer de verdade no fim é reprovado. Sem isso, a mensagem de um PR que
documenta o incidente derrubaria o próprio check — foi exatamente o que aconteceu no
push da versão 3.2.2.

O push na `main` audita também `$GITHUB_SHA~1..$GITHUB_SHA`, para pegar um merge commit
que ainda não esteja em nenhuma branch no momento do push.

## Usar a guarda em **outro** projeto

Três caminhos, do mais forte ao mais leve:

| Situação | O que fazer |
| --- | --- |
| projeto seu, com os arquivos da guarda | copie `scripts/guard_identity.py`, `.githooks/`, `.github/identity-*.txt` e o workflow; rode `install` |
| projeto de terceiro (ou que não quer os arquivos) | reutilize o workflow, sem copiar nada |
| repositório que você acabou de clonar | `install --global` já cobre; rode `doctor` para confirmar |

Workflow reutilizável, no `.github/workflows/ci.yml` do outro projeto:

```yaml
name: CI
on: [pull_request, push]
permissions:
  contents: read
jobs:
  identidade:
    uses: evertonldesouza/AgroData_Engine/.github/workflows/identity-guard.yml@main
```

O check aparece com o mesmo nome, `Guard · identidade`, e usa a guarda do repositório
central (baixa `scripts/guard_identity.py` se o projeto não tiver uma cópia). Para a base
ser outra que não `main`, passe `with: { base-ref: develop }`.

`identity-guard.yml` também aceita `workflow_dispatch`, então dá para rodar a varredura
manual em qualquer momento, sem esperar PR.

## Listas

| Arquivo | Papel |
| --- | --- |
| [`.github/identity-denylist.txt`](../.github/identity-denylist.txt) | expressões que nunca podem assinar (ferramentas) |
| [`.github/identity-allowlist.txt`](../.github/identity-allowlist.txt) | coautorias autorizadas (pessoas); o dono do repositório já está nela |

Os padrões base também estão em `scripts/guard_identity.py` (`DEFAULT_DENYLIST`) para a
verificação funcionar num projeto que ainda não tenha os arquivos — é o que permite a
guarda global agir num repositório vazio. O denylist tem precedência: uma identidade de
ferramenta nunca passa, mesmo que apareça na allowlist.

## Se um trailer já entrou no histórico

1. **Antes do merge** (o caso fácil): reescreva só a sua branch.

   ```bash
   git rebase -i origin/main          # marque os commits como "reword" e apague a linha
   # ou, em lote:
   FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f \
     --msg-filter 'python3 scripts/guard_identity.py strip-trailer' \
     -- origin/main..HEAD
   ```

2. **Depois do merge**: force push na `main` reescreve histórico e invalida clones —
   combinado com a equipe, é aceitável em projeto solo; em equipe, prefira deixar o
   commit antigo e garantir que os próximos saiam limpos.

3. **O que não tem conserto**: a página do PR que introduziu o commit continua mostrando
   o trailer (histórico de PR é imutável no GitHub). O que importa — `git log`, aba
   *Commits*, contagem de contribuidores — fica correto depois da reescrita.

## Verificação (faça uma vez por clone)

```bash
# 1. a guarda está ativa? (0 = sim; diz exatamente o que falta)
python scripts/guard_identity.py doctor

# 2. ela realmente reprova? (prova em repositório descartável, não mexe no seu)
python scripts/guard_identity.py self-test

# 3. o histórico deste repositório está limpo
python scripts/guard_identity.py check

# 4. nenhum hook ativo fora do hooksPath
ls .git/hooks | grep -v sample || echo "ok, nenhum hook em .git/hooks"

# 5. o hook barra de verdade? (deve falhar e não criar o commit)
git commit --allow-empty -m "teste" -m "Co-authored-by: arena-agent <x@y>"
```

Os passos 1 e 5 são os únicos que provam que a proteção existe naquele clone: um guard que
nunca reprovou nada não é guard. O `self-test` roda a mesma prova no CI.

## Falhas conhecidas da própria guarda

Uma guarda que reprova o commit honesto é pior que guarda nenhuma: a equipe aprende a
usar `--no-verify`. Quatro armadilhas já custaram um push vermelho na `main` (3.2.2):

| Sintoma | Causa | Correção |
| --- | --- | --- |
| mensagem que **explica** o trailer derruba o check | procurava `Co-authored-by:` em qualquer linha | só a cauda da mensagem conta (regra do git) |
| `main` vermelha por commit que ninguém vai empurrar | `rev-list --all` alcança branches remotas paradas | audita `refs/heads` + `HEAD` |
| o próprio autor legítimo reprovado | clone do CI commita com `users.noreply.github.com` | duas formas do dono na allowlist |
| guarda "instalada" que nunca roda | `install` apontou `hooksPath` para pasta sem `commit-msg` | `install` exige o hook e `doctor` detecta |

O contrário também acontece — a guarda **não** pega autor/committer escrito por variável de
ambiente (`GIT_AUTHOR_NAME=...`) antes do hook, nem assinatura por GPG de terceiro; para
isso existe a revisão do PR, e o hook é só uma barreira, não uma prova.

## Se este repositório servir de modelo para outros

O que é reutilizável é a combinação: `scripts/guard_identity.py` (fonte única da regra),
`.githooks/commit-msg` (cópia fiel de `HOOK_SCRIPT`, comparada por `doctor`),
`.github/identity-*.txt` (decisão do projeto) e `.github/workflows/identity-guard.yml`
(chamável por `workflow_call`). Ao mudar a regra, mude no script e rode
`python scripts/guard_identity.py install` para regravar o hook — se você editar o hook à
mão, `doctor` acusa divergência.
