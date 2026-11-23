# Identidade e autoria dos commits

Este documento existe porque um problema concreto aconteceu: um hook local injetava
`Co-authored-by: arena-agent <…>` em todo commit, e o trailer apareceu no commit da
`main` como se a ferramenta fosse coautora do projeto.

O ponto importante é o seguinte: **isso não se resolve limpando o histórico.** O hook
vive em `.git/hooks/`, é local, não aparece em `git grep` (não é versionado) e volta em
cada clone novo. A solução é defesa em camadas — e a primeira funciona em **qualquer
repositório**, inclusive nos que você ainda vai criar.

## As três camadas

| Camada | Onde vive | Quando age | Pega o quê |
| --- | --- | --- | --- |
| **1. Guarda local** | `scripts/guard_identity.py install` | no clone, antes de o commit existir | hook injetor instalado pela ferramenta |
| **2. Hook versionado** | `.githooks/commit-msg` | em cada `git commit` | mensagem com coautoria de ferramenta |
| **3. CI** | `Guard · identidade` (`identity-guard.yml`) | em todo PR e push na `main` | commit que escapou das camadas 1 e 2 |

Nenhuma delas altera mensagem sozinha: a regra é **reprovar**, não consertar. Mensagem
reescrita por script é o tipo de "correção" que esconde o problema.

### Camada 1 — guarda na origem (vale para todos os repositórios)

```bash
python scripts/guard_identity.py install
```

O que ele faz:

- move para `.git/hooks-disabled/` os hooks de mensagem (`commit-msg`,
  `prepare-commit-msg`, `pre-commit`, `pre-push`) que existirem no clone;
- aponta `core.hooksPath` para `.githooks/` (versionado), de modo que **qualquer** hook
  que a ferramenta instale depois em `.git/hooks/` seja ignorado pelo git;
- imprime a identidade configurada no clone (`user.name`/`user.email`) para você
  conferir que é a sua.

Aponte para outro projeto com `--repo`:

```bash
python scripts/guard_identity.py install --repo ~/outro-projeto
python scripts/guard_identity.py --repo ~/outro-projeto check
```

**Para valer em todos os projetos de uma vez**, configure o git global para usar um
diretório de hooks seu, e rode a guarda depois de cada clone:

```bash
# ~/.gitconfig  →  hooks centralizados (nunca os de .git/hooks/)
git config --global core.hooksPath ~/.githooks

# ~/.githooks/commit-msg  →  mesmo hook versionado deste repositório
mkdir -p ~/.githooks && cp .githooks/commit-msg ~/.githooks/ && chmod +x ~/.githooks/commit-msg
```

Com isso, um hook instalado pela ferramenta em `.git/hooks/` simplesmente nunca é
executado — em nenhum projeto. É a defesa mais barata que existe.

### Camada 2 — hook versionado (`.githooks/commit-msg`)

Reprova a mensagem que contenha `Co-authored-by:` de ferramenta conhecida. Só reprova:
não adiciona, não remove, não formata. Se `python` não existir na máquina, ele avisa e
deixa passar (falha de infraestrutura não deve bloquear trabalho).

Coautoria legítima (outra pessoa) passa a existir por decisão registrada em
[`.github/identity-allowlist.txt`](../.github/identity-allowlist.txt) — arquivo
versionado, revisado no PR como qualquer código.

### Camada 3 — CI (`Guard · identidade`)

Roda `python scripts/guard_identity.py check` e falha o PR quando encontra:

- **autor ou committer** casando com a denylist (ferramenta assinando o commit inteiro);
- **trailer** de coautoria de ferramenta;
- **trailer** de coautoria que não está na allowlist.

Em PR, audita só `origin/main..HEAD` (o que o PR acrescenta); em push na `main`, audita
tudo. Isso evita que um commit antigo, já revisado e publicado, bloqueie trabalho novo.

## Listas

| Arquivo | Papel |
| --- | --- |
| [`.github/identity-denylist.txt`](../.github/identity-denylist.txt) | expressões que nunca podem assinar (ferramentas) |
| [`.github/identity-allowlist.txt`](../.github/identity-allowlist.txt) | coautorias autorizadas (pessoas), vazio por padrão |

Os padrões base também estão em `scripts/guard_identity.py` (`DEFAULT_DENYLIST`) para a
verificação funcionar num projeto que ainda não tenha os arquivos.

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

## Verificação rápida (faça uma vez por clone)

```bash
# 1. nenhum hook ativo fora do .githooks
ls .git/hooks | grep -v sample || echo "ok, nenhum hook em .git/hooks"

# 2. o git usa os hooks versionados
git config --get core.hooksPath        # deve apontar para .../.githooks

# 3. o histórico está limpo
python scripts/guard_identity.py check

# 4. o hook realmente barra? (deve falhar)
git commit --allow-empty -m "teste" -m "Co-authored-by: arena-agent <x@y>"
git reset --hard HEAD~1   # se o commit acima tiver passado por engano
```

O passo 4 é o único que prova que a proteção existe: um guard que nunca reprovou nada
não é guard.
