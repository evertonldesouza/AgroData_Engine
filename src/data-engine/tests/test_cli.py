from __future__ import annotations

import json
from pathlib import Path

import pytest

from agrodata import __version__
from agrodata.cli import build_parser, main
from agrodata.config import get_settings


@pytest.fixture(autouse=True)
def _clean_settings_cache() -> None:
    get_settings.cache_clear()


@pytest.fixture
def sqlite_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> str:
    url = f"sqlite+pysqlite:///{tmp_path / 'agrodata.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("DATA_SOURCE", "simulated")
    monkeypatch.setenv("SYMBOLS", "SOJA,MILHO")
    return url


def test_version_command_prints_the_version(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["version"]) == 0
    assert capsys.readouterr().out.strip() == __version__


def test_parser_requires_a_command() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args([])


def test_init_db_creates_the_schema(sqlite_env: str, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["init-db"]) == 0
    assert "schema is up to date" in capsys.readouterr().out


def test_check_reports_a_reachable_database(
    sqlite_env: str, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["init-db"])
    capsys.readouterr()

    assert main(["check", "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["reachable"] is True
    assert payload["rows"] == 0


def test_collect_writes_rows_and_reports_json(
    sqlite_env: str, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["init-db"])
    capsys.readouterr()

    exit_code = main(["collect", "--json"])

    payload = json.loads(capsys.readouterr().out)
    assert exit_code == 0
    assert payload["inserted"] == 2
    assert payload["errors"] == []


def test_collect_dry_run_does_not_write(
    sqlite_env: str, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["init-db"])
    capsys.readouterr()

    main(["collect", "--dry-run", "--json"])
    report = json.loads(capsys.readouterr().out)
    main(["check", "--json"])
    state = json.loads(capsys.readouterr().out)

    assert report["inserted"] == 0
    assert state["rows"] == 0


def test_analyze_prints_a_table(sqlite_env: str, capsys: pytest.CaptureFixture[str]) -> None:
    main(["init-db"])
    main(["collect"])
    capsys.readouterr()

    assert main(["analyze", "--window", "1"]) == 0
    output = capsys.readouterr().out
    assert "SYMBOL" in output
    assert "SOJA" in output


def test_analyze_json_returns_trends(sqlite_env: str, capsys: pytest.CaptureFixture[str]) -> None:
    main(["init-db"])
    main(["collect"])
    capsys.readouterr()

    main(["analyze", "--json"])
    payload = json.loads(capsys.readouterr().out)

    assert {item["symbol"] for item in payload} == {"SOJA", "MILHO"}


def test_analyze_without_data_is_not_an_error(
    sqlite_env: str, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["init-db"])
    capsys.readouterr()

    assert main(["analyze"]) == 0
    assert "no data available" in capsys.readouterr().out


def test_invalid_configuration_exits_with_code_two(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.chdir("/tmp")

    assert main(["check"]) == 2
    assert "configuration error" in capsys.readouterr().err
