#!/usr/bin/env python3
"""Guarda de identidade: impede que ferramentas assinem commits no seu nome.

Problema que este script resolve
-------------------------------
Ferramentas de agente costumam se apresentar de duas formas no histórico:

1. instalando um hook no repositório (``.git/hooks/commit-msg``,
   ``.git/hooks/prepare-commit-msg``) que anexa um trailer como
   ``Co-authored-by: <ferramenta> <bot@users.noreply.github.com>`` a cada commit;
2. gravando o próprio nome em ``user.name`` / ``user.email``.

O hook é local e invisível para ``git grep`` (não é versionado), então ele
reaparece em cada clone novo. Este script ataca as duas frentes e ainda
**verifica o histórico** já produzido.

Camadas
-------
1. ``install`` — remove hooks que injetam trailer e aponta ``core.hooksPath``
   para ``.githooks/`` (versionado), que passa a ser a única fonte de hooks.
2. ``check`` — falha se algum commit do intervalo tiver trailer de coautoria não
   autorizado no allowlist ou autor/committer de ferramenta conhecida. É a mesma
   verificação que roda no CI (``Guard · identidade``), logo vale para todo PR.
3. ``clean`` — remove trailers indesejados de commits ainda não publicados
   (reescreve só o intervalo informado; nada é empurrado automaticamente).

Uso
---
    python scripts/guard_identity.py install           # no clone atual
    python scripts/guard_identity.py install --repo /caminho/do/outro/projeto
    python scripts/guard_identity.py check             # histórico completo
    python scripts/guard_identity.py check --range origin/main..HEAD
    python scripts/guard_identity.py clean --range HEAD~3..HEAD

Sem dependências externas: só Python 3.11+ e ``git``.
"""

from __future__ import annotations

import argparse
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

#: Hooks que conseguem reescrever a mensagem de um commit.
MESSAGE_HOOKS = (
    "commit-msg",
    "prepare-commit-msg",
    "pre-commit",
    "pre-push",
)

DENYLIST_FILE = Path(".github/identity-denylist.txt")
ALLOWLIST_FILE = Path(".github/identity-allowlist.txt")


class Git:
    """Thin wrapper that keeps the repo path in one place."""

    def __init__(self, repo: Path) -> None:
        self.repo = repo

    def run(self, *args: str, check: bool = True) -> str:
        result = subprocess.run(
            ["git", "-C", str(self.repo), *args],
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

    def config_set(self, key: str, value: str) -> None:
        self.run("config", key, value)


def load_patterns(repo: Path) -> list[str]:
    """Denylist = defaults + o que o repositório declarar no arquivo."""
    patterns = list(DEFAULT_DENYLIST)
    extra = repo / DENYLIST_FILE

    if extra.is_file():
        patterns.extend(
            line.strip()
            for line in extra.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")
        )

    return patterns


def load_allowlist(repo: Path) -> list[re.Pattern[str]]:
    """Identidades explicitamente permitidas em trailer de coautoria."""
    path = repo / ALLOWLIST_FILE
    if not path.is_file():
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


def commit_metadata(git: Git, sha: str) -> tuple[str, str, str]:
    """Returns (author, committer, message) with a stable separator."""
    raw = git.run("show", "-s", "--format=%an <%ae>%n%cn <%ce>%n%B", sha)
    author, committer, _, body = raw.split("\n", 3)
    return author.strip(), committer.strip(), body


def check(repo: Path, revision_range: str | None, *, quiet: bool = False) -> int:
    git = Git(repo)
    patterns = load_patterns(repo)
    allowlist = load_allowlist(repo)

    if revision_range is None:
        shas = git.run("rev-list", "--all").split()
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

        for line in message.splitlines():
            match = TRAILER.match(line.strip())
            if not match:
                continue

            identity = match.group(2).strip()
            hit = is_denied(identity, patterns)

            if hit:
                problems.append(f"{short}: trailer de coautoria bloqueado '{identity}' (padrão '{hit}')")
            elif not is_allowed(identity, allowlist):
                problems.append(
                    f"{short}: coautoria não autorizada '{identity}' "
                    f"— adicione à allowlist em {ALLOWLIST_FILE} se for legítima"
                )

    if problems:
        print(f"identidade: {len(problems)} problema(s) em {len(shas)} commit(s)", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    if not quiet:
        print(f"identidade ok — {len(shas)} commit(s) sem assinatura de ferramenta")
    return 0


def install(repo: Path) -> int:
    """Neutralises injecting hooks and points git at the versioned ones."""
    git = Git(repo)
    hooks_dir = repo / ".git" / "hooks"
    hooks_root = repo / ".githooks"
    disabled_dir = repo / ".git" / "hooks-disabled"

    removed: list[str] = []

    if hooks_dir.is_dir():
        for name in MESSAGE_HOOKS:
            candidate = hooks_dir / name
            if not candidate.is_file():
                continue

            content = candidate.read_text(encoding="utf-8", errors="replace")
            looks_injecting = bool(
                re.search(r"co-authored-by|signed-off-by|arena|agent", content, re.IGNORECASE)
            )

            disabled_dir.mkdir(exist_ok=True)
            shutil.move(str(candidate), str(disabled_dir / f"{name}.bak"))
            removed.append(name)
            if not looks_injecting:
                print(f"  aviso: {name} não parecia injetar trailer; movido para .git/hooks-disabled/")

    # Guard against a stale absolute path pointing at another checkout.
    if hooks_root.is_dir():
        git.config_set("core.hooksPath", str(hooks_root.resolve()))
        print(f"  core.hooksPath -> {hooks_root.relative_to(repo)}")
    else:
        print("  aviso: .githooks/ ausente — instale-o antes de confiar no guard")

    if removed:
        print(f"  hooks removidos: {', '.join(removed)}")
    else:
        print("  nenhum hook injetor encontrado")

    current = git.config_get("user.name") or "(vazio)"
    email = git.config_get("user.email") or "(vazio)"
    print(f"  identidade do clone: {current} <{email}>")

    return 0


def clean(repo: Path, revision_range: str, *, apply: bool) -> int:
    """Strips blocked trailers from unpublished commits."""
    git = Git(repo)
    patterns = load_patterns(repo)
    allowlist = load_allowlist(repo)
    shas = commit_range(git, revision_range)

    targets = []
    for sha in shas:
        _, _, message = commit_metadata(git, sha)
        for line in message.splitlines():
            match = TRAILER.match(line.strip())
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
    print(f"  FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f \\")
    print(f"    --msg-filter 'python3 scripts/guard_identity.py strip-trailer' \\")
    print(f"    -- {revision_range}")
    return 0


def strip_trailer() -> int:
    """msg-filter: removes blocked trailer lines from stdin."""
    patterns = list(DEFAULT_DENYLIST)
    kept: list[str] = []

    for line in sys.stdin.read().splitlines():
        match = TRAILER.match(line.strip())
        if match and is_denied(match.group(2).strip(), patterns):
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

    sub.add_parser("install", help="remove hooks injetores e ativa os hooks versionados")

    check_parser = sub.add_parser("check", help="verifica o histórico")
    check_parser.add_argument("--range", dest="range", default=None, help="ex.: origin/main..HEAD")
    check_parser.add_argument("--quiet", action="store_true")

    clean_parser = sub.add_parser("clean", help="lista (ou reescreve) trailers bloqueados")
    clean_parser.add_argument("--range", dest="range", default="origin/main..HEAD")
    clean_parser.add_argument("--apply", action="store_true")

    sub.add_parser("strip-trailer", help=argparse.SUPPRESS)

    args = parser.parse_args(argv)

    if args.command == "strip-trailer":
        return strip_trailer()

    repo = resolve_repo(args.repo)

    if args.command == "install":
        return install(repo)
    if args.command == "check":
        return check(repo, args.range, quiet=args.quiet)

    return clean(repo, args.range, apply=args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
