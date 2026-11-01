#!/usr/bin/env python3
"""Valida a documentação do repositório.

Documentação que não é verificada apodrece: links quebram, páginas somem do
índice e ninguém percebe. Este script é o "teste" da documentação e roda no
workflow ``CI · Docs``.

Verificações:

1. os documentos obrigatórios existem;
2. todo documento em ``docs/`` está listado no índice ``docs/README.md``;
3. todo ADR está listado em ``docs/adr/README.md``;
4. links relativos (``[texto](./x.md)``, ``src="..."``) apontam para arquivos reais;
5. blocos de código estão balanceados (uma cerca ``` sem par quebra o GitHub).

Uso::

    python scripts/check_docs.py            # falha com código 1 em erro
    python scripts/check_docs.py --verbose  # lista cada arquivo verificado
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
INDEX = DOCS / "README.md"
ADR_INDEX = DOCS / "adr" / "README.md"

#: Documentos que o projeto se compromete a manter (ver docs/README.md).
REQUIRED_DOCS = (
    "README.md",
    "docs/README.md",
    "docs/arquitetura.md",
    "docs/api.md",
    "docs/product-context.md",
    "docs/padroes-codigo.md",
    "docs/testes.md",
    "docs/seguranca.md",
    "docs/ci-cd.md",
    "docs/adr/README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "AGENTS.md",
    "CHANGELOG.md",
)

#: Arquivos markdown verificados na varredura de links.
SCAN_GLOBS = (
    "*.md",
    "docs/**/*.md",
    ".github/**/*.md",
    "src/*/README.md",
)

LINK = re.compile(r"(?<!\!)\[(?:[^\]\[]|\[[^\]]*\])*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
IMAGE_SRC = re.compile(r"<img[^>]+src=\"([^\"]+)\"", re.IGNORECASE)
FENCE = re.compile(r"^\s*(```|~~~)", re.MULTILINE)
SKIPPED_SCHEMES = ("http://", "https://", "mailto:", "#", "tel:")


class Report:
    """Accumulates problems so every issue is reported in a single run."""

    def __init__(self) -> None:
        self.errors: list[str] = []
        self.checked_files = 0
        self.checked_links = 0

    def error(self, where: Path | str, message: str) -> None:
        location = where.relative_to(ROOT) if isinstance(where, Path) else where
        self.errors.append(f"{location}: {message}")


def strip_code(markdown: str) -> str:
    """Replaces fenced code blocks with blank lines (keeps line numbers)."""
    output: list[str] = []
    inside = False

    for line in markdown.splitlines():
        if FENCE.match(line):
            inside = not inside
            output.append("")
            continue
        output.append("" if inside else line)

    return "\n".join(output)


def markdown_files() -> list[Path]:
    files: set[Path] = set()
    for pattern in SCAN_GLOBS:
        files.update(path for path in ROOT.glob(pattern) if path.is_file())

    return sorted(files)


def check_required_docs(report: Report) -> None:
    for relative in REQUIRED_DOCS:
        if not (ROOT / relative).is_file():
            report.error("docs", f"documento obrigatório ausente: {relative}")


def check_index(report: Report, files: list[Path]) -> None:
    """Every documentation page must be reachable from the index."""
    if not INDEX.is_file():
        return

    index_text = strip_code(INDEX.read_text(encoding="utf-8"))

    for path in sorted(DOCS.rglob("*.md")):
        # ADRs have their own index, validated by check_adr_index().
        if path == INDEX or path.parent.name == "adr":
            continue
        relative = path.relative_to(INDEX.parent).as_posix()
        if relative not in index_text:
            report.error(INDEX, f"página não listada no índice: docs/{relative}")


def check_adr_index(report: Report) -> None:
    if not ADR_INDEX.is_file():
        return

    adr_text = strip_code(ADR_INDEX.read_text(encoding="utf-8"))
    adrs = sorted((DOCS / "adr").glob("[0-9][0-9][0-9][0-9]-*.md"))

    if not adrs:
        report.error(ADR_INDEX, "nenhum ADR encontrado")
        return

    for adr in adrs:
        if adr.name not in adr_text:
            report.error(ADR_INDEX, f"ADR não listado na tabela: {adr.name}")


def iter_targets(markdown: str) -> list[str]:
    targets = LINK.findall(strip_code(markdown))
    targets.extend(IMAGE_SRC.findall(strip_code(markdown)))
    return targets


def check_links(report: Report, files: list[Path]) -> None:
    for path in files:
        report.checked_files += 1
        markdown = path.read_text(encoding="utf-8")

        for target in iter_targets(markdown):
            report.checked_links += 1
            if target.startswith(SKIPPED_SCHEMES):
                continue

            # Anchors in other files are validated by GitHub, not by us.
            clean = target.split("#", 1)[0]
            if not clean:
                continue

            resolved = (path.parent / clean).resolve()
            if not resolved.exists():
                report.error(path, f"link quebrado: {target}")


def check_code_fences(report: Report, files: list[Path]) -> None:
    for path in files:
        fences = len(FENCE.findall(path.read_text(encoding="utf-8")))
        if fences % 2 != 0:
            report.error(path, f"bloco de código sem fechamento ({fences} cercas)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Valida a documentação do repositório.")
    parser.add_argument("--verbose", action="store_true", help="lista cada arquivo verificado")
    args = parser.parse_args(argv)

    files = markdown_files()
    report = Report()

    check_required_docs(report)
    check_index(report, files)
    check_adr_index(report)
    check_links(report, files)
    check_code_fences(report, files)

    if args.verbose:
        for path in files:
            print(f"  ok {path.relative_to(ROOT).as_posix()}")

    summary = f"{report.checked_files} arquivos, {report.checked_links} links verificados"

    if report.errors:
        print(f"documentação inválida — {len(report.errors)} problema(s):", file=sys.stderr)
        for error in report.errors:
            print(f"  - {error}", file=sys.stderr)
        print(f"\n{summary}", file=sys.stderr)
        return 1

    print(f"documentação ok — {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
