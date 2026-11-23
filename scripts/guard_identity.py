#!/usr/bin/env python3
"""Guarda de identidade: impede que ferramentas assinem commits no seu nome.

Problema que este script resolve
--------------------------------
Ferramentas de agente costumam se apresentar de duas formas no histórico:

1. instalando um hook no repositório (``.git/hooks/commit-msg``,
   ``.git/hooks/prepare-commit-msg``) que anexa um trailer como
   ``Co-authored-by: <ferramenta> <bot@users.noreply.github.com>`` a cada commit;
2. gravando o próprio nome em ``user.name`` / ``user.email``.

O hook é local e invisível para ``git grep`` (não é versionado), então ele
reaparece em cada clone novo. Este script ataca as duas frentes, verifica o
histórico já produzido e pode ser instalado **na máquina inteira**, não só num
repositório — ver ``install --global``.

Camadas
-------
1. ``install`` — remove hooks que injetam trailer e aponta ``core.hooksPath``
   para os hooks versionados do repositório (``.githooks/``).
   ``install --global`` faz o mesmo para a máquina: um hook em ``~/.githooks/``
   guardado por este script, aplicado a **todos** os clones de qualquer projeto,
   inclusive os que nunca ouviram falar desta guarda.
2. ``check`` — falha se algum commit do intervalo tiver autor, committer ou
   trailer de coautoria bloqueado. É a mesma verificação que roda no CI.
3. ``check-msg`` — valida um arquivo de mensagem de commit. É o que os hooks
   chamam, para não haver duas implementações da regra.
4. ``scan`` / ``doctor`` — audita vários repositórios de uma vez e mostra, para
   cada um, se a proteção está mesmo ativa.
5. ``clean`` — remove trailers indesejados de commits ainda não publicados.

Uso
---
    python scripts/guard_identity.py install            # este repositório
    python scripts/guard_identity.py install --global   # toda a máquina
    python scripts/guard_identity.py check              # histórico local
    python scripts/guard_identity.py check --range origin/main..HEAD
    python scripts/guard_identity.py check-msg .git/COMMIT_EDITMSG
    python scripts/guard_identity.py scan ~/projetos    # todos os repos da pasta
    python scripts/guard_identity.py doctor             # a proteção está ativa?

Sem dependências externas: só Python 3.11+ e ``git``.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

#: Nomes/emails de ferramentas que nunca devem assinar um commit deste projeto.
#: Comparados em minúsculas contra "Nome <email>". Adicione novas aqui ou no
#: arquivo .github/identity-denylist.txt (uma expressão por linha).
DEFAULT_DENYLIST = (
    r"arena-agent",
    r"copilot-swe-agent",
    r"copilot",
    r"swe-agent",
    r"codex",
    r"claude-code",
    r"claude\[bot\]",
    r"gemini-code-assist",
    r"cursor-agent",
    r"openhands",
    r"devin-ai",
    r"jules",
)

#: Padrão de linha de trailer de coautoria.
TRAILER = re.compile(r"^(co-authored-by|co-developed-by)\s*:\s*(.+)$", re.IGNORECASE)

#: Qualquer linha "Chave: valor" — usado só para delimitar o bloco final de
#: trailers (um ``Signed-off-by`` acima não pode esconder um ``Co-authored-by``).
ANY_TRAILER = re.compile(r"^[A-Za-z][\w.-]*(?:[ \t][A-Za-z][\w.-]*)*\s*:\s*\S")

#: Trailer de verdade só existe na *cauda* da mensagem (git interpret-trailers).
#: Procurar em qualquer linha do corpo dá falso positivo quando a mensagem cita o
#: trailer — foi assim que o push da main quebrou na versão 3.2.2.
TRAILER_TAIL = 10

#: Hooks que conseguem reescrever a mensagem de um commit.
MESSAGE_HOOKS = (
    "commit-msg",
    "prepare-commit-msg",
    "pre-commit",
    "pre-push",
)

DENYLIST_FILE = Path(".github/identity-denylist.txt")
ALLOWLIST_FILE = Path(".github/identity-allowlist.txt")

#: Onde a instalação global guarda o script e os hooks (caminhos já expandidos:
#: ``Path("~/x")`` é relativo, e o git gravaria isso literalmente no config).
GLOBAL_HOME = Path.home() / ".local" / "share" / "guard-identity"
GLOBAL_HOOKS = Path.home() / ".githooks"

#: Conteúdo do hook de mensagem. O ``.githooks/commit-msg`` versionado é uma
#: cópia fiel deste texto; ``doctor`` compara os dois e avisa se derivarem.
HOOK_SCRIPT = """#!/bin/sh
#
# Guarda de identidade — bloqueia commit que assina uma ferramenta.
# Gerado por `python scripts/guard_identity.py install [--global]`.
#
# Só REPROVA, nunca altera a mensagem. A regra vive em guard_identity.py
# (comando check-msg), para não existir uma segunda implementação dela aqui.
#
# Falha de infraestrutura (python ausente, guarda não instalada) avisa e deixa
# passar: um repositório sem a guarda não pode impedir o trabalho.

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
GUARD="$ROOT/scripts/guard_identity.py"
[ -f "$GUARD" ] || GUARD="$HOME/.local/share/guard-identity/guard_identity.py"

if [ ! -f "$GUARD" ]; then
  echo "aviso: guarda de identidade não encontrada — commit liberado" >&2
  exit 0
fi

PYTHON=$(command -v python3 || command -v python || true)
if [ -z "$PYTHON" ]; then
  echo "aviso: python não encontrado — guarda de identidade ignorada" >&2
  exit 0
fi

exec "$PYTHON" "$GUARD" check-msg "$1"
"""


class Git:
    """Thin wrapper that keeps the repo path in one place."""

    def __init__(self, repo: Path | None) -> None:
        self.repo = repo

    def run(self, *args: str, check: bool = True) -> str:
        cmd = ["git"]
        if self.repo is not None:
            cmd += ["-C", str(self.repo)]

        result = subprocess.run(
            [*cmd, *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if check and result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} falhou")
        return result.stdout

    def config_get(self, key: str) -> str | None:
        value = self.run("config", "--get", key, check=False).strip()
        return value or None

    def config_set(self, key: str, value: str, *, global_scope: bool = False) -> None:
        scope = ["--global"] if global_scope else []
        self.run("config", *scope, key, value)

    def toplevel(self) -> Path | None:
        value = self.run("rev-parse", "--show-toplevel", check=False).strip()
        return Path(value) if value else None


def load_patterns(repo: Path | None) -> list[str]:
    """Denylist = defaults + o que o repositório declarar no arquivo."""
    patterns = list(DEFAULT_DENYLIST)
    extra = repo / DENYLIST_FILE if repo is not None else None

    if extra is not None and extra.is_file():
        patterns.extend(
            line.strip()
            for line in extra.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")
        )

    return patterns


def load_allowlist(repo: Path | None) -> list[re.Pattern[str]]:
    """Identidades explicitamente permitidas em trailer de coautoria."""
    path = repo / ALLOWLIST_FILE if repo is not None else None
    if path is None or not path.is_file():
        return []

    lines = [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]

    return [re.compile(line, re.IGNORECASE) for line in lines]


def is_denied(identity: str, patterns: list[str]) -> str | None:
    lowered = identity.lower()
    for pattern in patterns:
        if re.search(pattern, lowered):
            return pattern
    return None


def is_allowed(identity: str, allowlist: list[re.Pattern[str]]) -> bool:
    return any(pattern.search(identity) for pattern in allowlist)


def commit_range(git: Git, revision_range: str) -> list[str]:
    return git.run("rev-list", revision_range).split()


def trailer_lines(message: str) -> list[str]:
    """Linhas que o git reconheceria como trailer: fim da mensagem, sem prosa.

    O git só entende como trailer o bloco final composto de linhas ``Chave: valor``
    (um trailer por linha, sem parágrafo depois). Paramos no primeiro parágrafo,
    no comentário ou numa linha que não seja ``Chave: valor``.
    """
    lines = [line.strip() for line in message.rstrip().splitlines()]

    if not lines:
        return []

    found: list[str] = []
    for line in reversed(lines[-TRAILER_TAIL:]):
        if not line:
            break
        if line.startswith("#") or not ANY_TRAILER.match(line):
            break
        found.append(line)

    return [line for line in found if TRAILER.match(line)]


def commit_metadata(git: Git, sha: str) -> tuple[str, str, str]:
    """Returns (author, committer, message) with a stable separator."""
    raw = git.run("show", "-s", "--format=%an <%ae>%n%cn <%ce>%n%B", sha)
    author, committer, _, body = raw.split("\n", 3)
    return author.strip(), committer.strip(), body


def message_problems(message: str, patterns: list[str], allowlist: list[re.Pattern[str]]) -> list[str]:
    """Problemas que a mensagem sozinha revela (trailer de coautoria)."""
    problems: list[str] = []

    for line in trailer_lines(message):
        match = TRAILER.match(line)
        if not match:
            continue

        identity = match.group(2).strip()
        hit = is_denied(identity, patterns)

        if hit:
            problems.append(f"trailer de coautoria bloqueado '{identity}' (padrão '{hit}')")
        elif not is_allowed(identity, allowlist):
            problems.append(
                f"coautoria não autorizada '{identity}' "
                f"— adicione à allowlist em {ALLOWLIST_FILE} se for legítima"
            )

    return problems


def check(repo: Path, revision_range: str | None, *, quiet: bool = False) -> int:
    git = Git(repo)
    patterns = load_patterns(repo)
    allowlist = load_allowlist(repo)

    if revision_range is None:
        # ``--branches`` (refs/heads) + HEAD, não ``--all``. ``--all`` inclui
        # ``refs/remotes/origin/*``: uma branch parada, criada antes de uma
        # reescrita de histórico, mantém commits antigos vivos e derruba o check
        # da main por causa de um commit que ninguém vai empurrar de novo. Essas
        # branches são julgadas quando o PR delas tentar entrar (comparação com
        # origin/main), que é o momento em que o conteúdo realmente importa.
        shas = git.run("rev-list", "--branches", "HEAD").split()
    else:
        shas = commit_range(git, revision_range)

    problems: list[str] = []

    for sha in shas:
        author, committer, message = commit_metadata(git, sha)
        short = sha[:7]

        for role, identity in (("autor", author), ("committer", committer)):
            hit = is_denied(identity, patterns)
            if hit:
                problems.append(f"{short}: {role} '{identity}' casa com o padrão '{hit}'")

        for problem in message_problems(message, patterns, allowlist):
            problems.append(f"{short}: {problem}")

    if problems:
        print(f"identidade: {len(problems)} problema(s) em {len(shas)} commit(s)", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    if not quiet:
        print(f"identidade ok — {len(shas)} commit(s) sem assinatura de ferramenta")
    return 0


def check_msg(path: Path) -> int:
    """Valida a mensagem de um commit em criação (usado pelos hooks)."""
    try:
        message = path.read_text(encoding="utf-8", errors="replace")
    except OSError as error:
        print(f"aviso: não foi possível ler {path}: {error}", file=sys.stderr)
        return 0

    git = Git(None)
    repo = git.toplevel()
    problems = message_problems(message, load_patterns(repo), load_allowlist(repo))

    if not problems:
        return 0

    print(
        "\n  ────────────────────────────────────────────────────────────────\n"
        "  Commit bloqueado: a mensagem assina uma ferramenta como coautora.\n\n"
        '  Corrija removendo a linha "Co-authored-by: ..." da mensagem.\n'
        "  Se a coautoria for legítima (outra pessoa), adicione o padrão em\n"
        "  .github/identity-allowlist.txt e registre no PR.\n"
        "  ────────────────────────────────────────────────────────────────\n",
        file=sys.stderr,
    )
    for problem in problems:
        print(f"  - {problem}", file=sys.stderr)

    return 1


def _print_identity(git: Git) -> None:
    current = git.config_get("user.name") or "(vazio)"
    email = git.config_get("user.email") or "(vazio)"
    print(f"  identidade do clone: {current} <{email}>")


def _remove_local_hooks_path(git: Git) -> None:
    """Remove core.hooksPath local para o global (com a guarda) voltar a valer."""
    git.run("config", "--unset", "core.hooksPath", check=False)


def _has_guard_hook(repo: Path, hooks_path: str) -> bool:
    """O hooksPath apontado já contém o hook da guarda?"""
    candidate = Path(os.path.expanduser(hooks_path))
    if not candidate.is_absolute():
        candidate = repo / candidate

    hook = candidate / "commit-msg"
    if not hook.is_file():
        return False

    try:
        return "check-msg" in hook.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return False


def _write_hook(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(HOOK_SCRIPT, encoding="utf-8")
    path.chmod(0o755)


def _disable_injecting_hooks(hooks_dir: Path, disabled_dir: Path) -> list[str]:
    removed: list[str] = []

    if not hooks_dir.is_dir():
        return removed

    for name in MESSAGE_HOOKS:
        candidate = hooks_dir / name
        if not candidate.is_file():
            continue

        content = candidate.read_text(encoding="utf-8", errors="replace")
        looks_injecting = bool(
            re.search(r"co-authored-by|signed-off-by|arena|agent", content, re.IGNORECASE)
        )

        disabled_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(candidate), str(disabled_dir / f"{name}.bak"))
        removed.append(name)
        if not looks_injecting:
            print(f"  aviso: {name} não parecia injetar trailer; movido para {disabled_dir}")

    return removed


def install(repo: Path, *, global_scope: bool = False) -> int:
    """Neutralises injecting hooks and points git at trustworthy ones."""
    git = Git(repo)

    if global_scope:
        _write_hook(GLOBAL_HOOKS / "commit-msg")
        target = GLOBAL_HOME / "guard_identity.py"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(Path(__file__).resolve(), target)

        git.config_set("core.hooksPath", str(GLOBAL_HOOKS), global_scope=True)
        print(f"  core.hooksPath (global) -> {GLOBAL_HOOKS}")
        print(f"  guarda copiada para {target}")
        print("  hook aplicado a todo clone de qualquer repositório desta conta")
        print(
            "\n  Observação: um repositório que define o próprio core.hooksPath tem\n"
            "  precedência sobre o global. Rode `install` nele também."
        )
        return 0

    hooks_dir = repo / ".git" / "hooks"
    hooks_root = repo / ".githooks"
    disabled_dir = repo / ".git" / "hooks-disabled"

    removed = _disable_injecting_hooks(hooks_dir, disabled_dir)

    existing = git.config_get("core.hooksPath")
    if existing and _has_guard_hook(repo, existing):
        print(f"  core.hooksPath já aponta para uma guarda: {existing}")
        _print_identity(git)
        return 0

    if existing:
        # hooksPath próprio e sem a guarda vence o global: o hook nunca rodaria.
        print(f"  core.hooksPath era {existing} (sem commit-msg)")

    has_versioned = (hooks_root / "commit-msg").is_file()
    has_global = (GLOBAL_HOOKS / "commit-msg").is_file()

    if has_versioned:
        git.config_set("core.hooksPath", str(hooks_root.resolve()))
        print(f"  core.hooksPath -> {hooks_root.relative_to(repo)}")
    elif has_global:
        _remove_local_hooks_path(git)
        print(f"  sem .githooks/ aqui: usando a guarda global {GLOBAL_HOOKS}/commit-msg")
    else:
        print(
            "  aviso: este repositório não tem .githooks/ e a guarda global não está "
            "instalada — rode `install --global`"
        )

    if removed:
        print(f"  hooks removidos: {', '.join(removed)}")
    else:
        print("  nenhum hook injetor encontrado")

    _print_identity(git)
    return 0


def self_test() -> int:
    """Prova que a guarda reprova um trailer e aprova um commit limpo.

    Usa um repositório descartável; não toca no repositório atual. Uma guarda que
    nunca reprovou nada não é guarda — este é o teste que aparece no CI.
    """
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        repo = Path(tmp)
        git = Git(repo)
        git.run("init", "-q", "-b", "main")
        git.config_set("user.name", "Teste")
        git.config_set("user.email", "teste@example.com")
        (repo / "f").write_text("x", encoding="utf-8")
        git.run("add", "f")
        git.run("commit", "-q", "-m", "chore: init")

        bad = (repo / "bad.txt")
        bad.write_text("feat: x\n\nCo-authored-by: arena-agent <a@b>\n", encoding="utf-8")
        denied = check_msg(bad) != 0
        bad.unlink()

        prosa = repo / "prosa.txt"
        prosa.write_text(
            "feat: x\n\nO commit anterior citava Co-authored-by: arena-agent <a@b> "
            "no meio do texto.\n",
            encoding="utf-8",
        )
        prose_ok = check_msg(prosa) == 0

        (repo / "ok.txt").write_text("feat: x\n\nmensagem normal\n", encoding="utf-8")
        clean_ok = check_msg(repo / "ok.txt") == 0

    passed = denied and prose_ok and clean_ok
    print(f"  trailer de ferramenta reprovado: {'ok' if denied else 'FALHOU'}")
    print(f"  prosa citando trailer aprovada:  {'ok' if prose_ok else 'FALHOU'}")
    print(f"  mensagem limpa aprovada:         {'ok' if clean_ok else 'FALHOU'}")
    print("\nself-test: " + ("ok" if passed else "FALHOU"))
    return 0 if passed else 1


def repo_status(repo: Path) -> tuple[bool, list[str]]:
    """(protegido?, linhas para imprimir) — o que `doctor` e `scan` mostram."""
    git = Git(repo)
    lines: list[str] = []

    hooks_path = git.config_get("core.hooksPath")
    hooks_dir = repo / ".git" / "hooks"
    active = (
        sorted(p.name for p in hooks_dir.iterdir() if not p.name.endswith(".sample"))
        if hooks_dir.is_dir()
        else []
    )

    guard_hook = False
    if hooks_path:
        candidate = Path(os.path.expanduser(hooks_path))
        if not candidate.is_absolute():
            candidate = repo / candidate
        guard_hook = (candidate / "commit-msg").is_file()
        lines.append(f"core.hooksPath: {hooks_path}" + ("" if guard_hook else "  (sem commit-msg)"))
    else:
        lines.append("core.hooksPath: (não definido)")

    if active:
        lines.append(f"hooks ativos em .git/hooks: {', '.join(active)}")

    identity = f"{git.config_get('user.name') or '?'} <{git.config_get('user.email') or '?'}>"
    lines.append(f"identidade: {identity}")

    status = check(repo, None, quiet=True)
    lines.append("histórico: " + ("ok" if status == 0 else "PROBLEMAS (veja acima)"))
    if status != 0:
        check(repo, None)

    protected = guard_hook and status == 0
    global_guard = _has_guard_hook(repo, str(GLOBAL_HOOKS)) if GLOBAL_HOOKS.is_dir() else False
    if not hooks_path and global_guard:
        lines.append(f"guard hooksPath global com a guarda: {GLOBAL_HOOKS}")
        guard_hook = True
        protected = status == 0
    if not hooks_path and not global_guard:
        lines.append("dica: rode `install` ou `install --global`")
    elif not guard_hook:
        lines.append("dica: este repositório define hooksPath próprio — rode `install` aqui")

    return protected, lines


def doctor(repo: Path) -> int:
    print(f"guarda de identidade — {repo}")
    protected, lines = repo_status(repo)
    for line in lines:
        print(f"  {line}")

    versioned = repo / ".githooks" / "commit-msg"
    if versioned.is_file():
        same = versioned.read_text(encoding="utf-8") == HOOK_SCRIPT
        print(f"  .githooks/commit-msg: {'igual ao do script' if same else 'DIVERGENTE do script'}")

    print("\n" + ("proteção ATIVA neste repositório" if protected else "proteção INCOMPLETA"))
    return 0 if protected else 1


def iter_repos(root: Path) -> list[Path]:
    """Repositórios git sob `root` (sem descer em node_modules, venv, .git)."""
    if (root / ".git").exists():
        return [root]

    skip = {"node_modules", ".venv", "venv", "env", "dist", "build", "bin", "obj", "target"}
    repos: list[Path] = []

    for current, dirs, _ in os.walk(root):
        dirs[:] = [d for d in dirs if d not in skip and not d.startswith(".cache")]
        if Path(current, ".git").exists():
            repos.append(Path(current))
            dirs[:] = []

    return sorted(repos)


def scan(roots: list[Path]) -> int:
    repos: list[Path] = []
    for root in roots:
        repos.extend(iter_repos(root.resolve()))

    if not repos:
        print("nenhum repositório git encontrado")
        return 0

    unprotected = 0
    for repo in repos:
        protected, lines = repo_status(repo)
        if not protected:
            unprotected += 1
        print(f"\n{'ok  ' if protected else 'FALHA'} {repo}")
        for line in lines:
            print(f"      {line}")

    print(f"\n{len(repos)} repositório(s) — {len(repos) - unprotected} protegido(s), {unprotected} com pendência")
    return 0 if unprotected == 0 else 1


def clean(repo: Path, revision_range: str, *, apply: bool) -> int:
    """Strips blocked trailers from unpublished commits."""
    git = Git(repo)
    patterns = load_patterns(repo)
    allowlist = load_allowlist(repo)
    shas = commit_range(git, revision_range)

    targets = []
    for sha in shas:
        _, _, message = commit_metadata(git, sha)
        for line in trailer_lines(message):
            match = TRAILER.match(line)
            if not match:
                continue
            identity = match.group(2).strip()
            if is_denied(identity, patterns) or not is_allowed(identity, allowlist):
                targets.append((sha[:7], identity))

    if not targets:
        print(f"nada a limpar em {revision_range}")
        return 0

    for sha, identity in targets:
        print(f"  {sha}: {identity}")

    if not apply:
        print("\nmodo simulação — rode com --apply para reescrever")
        return 0

    print("\nrode manualmente (a reescrita é destrutiva e exige revisão):")
    print("  FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f \\")
    print("    --msg-filter 'python3 scripts/guard_identity.py strip-trailer' \\")
    print(f"    -- {revision_range}")
    return 0


def strip_trailer() -> int:
    """msg-filter: removes blocked trailer lines from stdin."""
    patterns = list(DEFAULT_DENYLIST)
    message = sys.stdin.read()
    kept: list[str] = []

    tail = set(trailer_lines(message))

    for line in message.splitlines():
        match = TRAILER.match(line.strip())
        if match and line.strip() in tail and is_denied(match.group(2).strip(), patterns):
            continue
        kept.append(line)

    while kept and not kept[-1].strip():
        kept.pop()

    sys.stdout.write("\n".join(kept) + "\n")
    return 0


def resolve_repo(path: str) -> Path:
    repo = Path(path).resolve()
    if not (repo / ".git").exists():
        raise SystemExit(f"não é um repositório git: {repo}")
    return repo


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Guarda de identidade para commits.")
    parser.add_argument("--repo", default=".", help="caminho do repositório (default: .)")
    sub = parser.add_subparsers(dest="command", required=True)

    install_parser = sub.add_parser("install", help="remove hooks injetores e ativa a guarda")
    install_parser.add_argument(
        "--global", dest="global_scope", action="store_true", help="vale para toda a máquina"
    )

    check_parser = sub.add_parser("check", help="verifica o histórico")
    check_parser.add_argument("--range", dest="range", default=None, help="ex.: origin/main..HEAD")
    check_parser.add_argument("--quiet", action="store_true")

    check_msg_parser = sub.add_parser("check-msg", help="valida um arquivo de mensagem")
    check_msg_parser.add_argument("path", nargs="?", default=".git/COMMIT_EDITMSG")

    sub.add_parser("doctor", help="mostra se a proteção está ativa neste repositório")
    sub.add_parser("self-test", help="prova que a guarda reprova um trailer de ferramenta")

    scan_parser = sub.add_parser("scan", help="audita todos os repositórios sob os caminhos")
    scan_parser.add_argument("paths", nargs="*", default=["."])

    clean_parser = sub.add_parser("clean", help="lista (ou reescreve) trailers bloqueados")
    clean_parser.add_argument("--range", dest="range", default="origin/main..HEAD")
    clean_parser.add_argument("--apply", action="store_true")

    sub.add_parser("strip-trailer", help=argparse.SUPPRESS)

    args = parser.parse_args(argv)

    if args.command == "strip-trailer":
        return strip_trailer()
    if args.command == "check-msg":
        return check_msg(Path(args.path))
    if args.command == "scan":
        return scan([Path(p) for p in args.paths])
    if args.command == "self-test":
        return self_test()

    repo = resolve_repo(args.repo)

    if args.command == "install":
        return install(repo, global_scope=args.global_scope)
    if args.command == "check":
        return check(repo, args.range, quiet=args.quiet)
    if args.command == "doctor":
        return doctor(repo)

    return clean(repo, args.range, apply=args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
