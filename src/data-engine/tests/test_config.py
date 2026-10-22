from __future__ import annotations

import pytest
from pydantic import ValidationError

from agrodata.config import Settings


def test_symbols_are_parsed_from_a_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:secret@localhost:5432/db")
    monkeypatch.setenv("SYMBOLS", "soja, milho ,cafe")

    settings = Settings()

    assert settings.symbols == ("SOJA", "MILHO", "CAFE")


def test_default_symbols_are_used_when_env_is_blank() -> None:
    settings = Settings(database_url="postgresql://localhost/db", symbols="")
    assert settings.symbols == ("SOJA", "MILHO")


def test_password_is_masked_in_logs() -> None:
    settings = Settings(database_url="postgresql://user:supersecret@db:5432/agrodata")
    masked = settings.masked_database_url

    assert "supersecret" not in masked
    assert masked == "postgresql://user:***@db:5432/agrodata"


def test_http_source_requires_a_url() -> None:
    with pytest.raises(ValidationError, match="COMMODITY_API_URL"):
        Settings(database_url="postgresql://localhost/db", data_source="http")


def test_unknown_source_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(database_url="postgresql://localhost/db", data_source="carrier-pigeon")


def test_database_url_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)  # type: ignore[call-arg]
