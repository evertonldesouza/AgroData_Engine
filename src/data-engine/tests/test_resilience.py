"""Resilience of the engine against a flaky database.

These cases mirror the real incident of 2026-10-23: a scheduled ingestion failed
because the database refused a single connection, and the whole hour was lost.
"""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from agrodata.config import Settings
from agrodata.db import is_database_reachable, verify_connection
from agrodata.models import CommodityPrice
from agrodata.pipeline import run_pipeline
from agrodata.schemas import PriceSample


class _Connection:
    def execute(self, _statement: Any) -> None:
        return None


class _FlakyEngine:
    """Engine whose first ``failures`` connections raise a transient error."""

    def __init__(self, failures: int) -> None:
        self._failures = failures
        self.calls = 0

    def connect(self) -> Any:
        self.calls += 1
        if self.calls <= self._failures:
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))
        connection = _Connection()

        class _Context:
            def __enter__(self) -> _Connection:
                return connection

            def __exit__(self, *_exc: object) -> None:
                return None

        return _Context()


def _settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "database_url": "sqlite://",
        "symbols": ("SOJA", "MILHO"),
        "db_connect_attempts": 3,
        "db_retry_backoff_seconds": 0.01,
    }
    values.update(overrides)
    return Settings(**values)


def test_verify_connection_survives_a_transient_failure() -> None:
    engine = _FlakyEngine(failures=2)

    verify_connection(engine, attempts=3, backoff_seconds=0.01)

    assert engine.calls == 3


def test_verify_connection_raises_after_the_attempts_are_exhausted() -> None:
    engine = _FlakyEngine(failures=5)

    with pytest.raises(OperationalError):
        verify_connection(engine, attempts=2, backoff_seconds=0.01)

    assert engine.calls == 2


def test_is_database_reachable_reports_booleans() -> None:
    assert is_database_reachable(_FlakyEngine(failures=0)) is True
    assert is_database_reachable(_FlakyEngine(failures=99), attempts=1) is False


class _FlakySession:
    """Wraps a real session and fails the first ``failures`` commits."""

    def __init__(self, session: Session, failures: int) -> None:
        self._session = session
        self._remaining = failures
        self.commits = 0

    def __getattr__(self, item: str) -> Any:
        return getattr(self._session, item)

    def commit(self) -> None:
        self.commits += 1
        if self._remaining > 0:
            self._remaining -= 1
            raise OperationalError("INSERT", {}, Exception("server closed the connection"))
        self._session.commit()

    def __enter__(self) -> _FlakySession:
        return self

    def __exit__(self, *_exc: object) -> None:
        self._session.close()


class _SessionFactory:
    def __init__(self, factory: sessionmaker[Session], failures: int) -> None:
        self._factory = factory
        self._failures = failures
        self.sessions: list[_FlakySession] = []

    def __call__(self) -> _FlakySession:
        session = _FlakySession(self._factory(), self._failures)
        self.sessions.append(session)
        return session


class _StubCollector:
    name = "stub"

    def collect(self, symbol: str) -> PriceSample:
        return PriceSample(symbol, 100.0 + len(symbol))


def _count(factory: sessionmaker[Session]) -> int:
    with factory() as session:
        return session.execute(select(func.count()).select_from(CommodityPrice)).scalar_one()


def test_pipeline_retries_the_write_after_a_transient_error(
    session_factory: sessionmaker[Session],
) -> None:
    flaky = _SessionFactory(session_factory, failures=1)

    report = run_pipeline(_settings(), _StubCollector(), flaky)  # type: ignore[arg-type]

    assert report.ok
    assert report.inserted == 2
    assert _count(session_factory) == 2
    assert sum(session.commits for session in flaky.sessions) == 2


def test_pipeline_reports_a_database_error_instead_of_crashing(
    session_factory: sessionmaker[Session],
) -> None:
    flaky = _SessionFactory(session_factory, failures=99)

    report = run_pipeline(  # type: ignore[arg-type]
        _settings(db_connect_attempts=2), _StubCollector(), flaky
    )

    assert not report.ok
    assert report.inserted == 0
    assert any(error.startswith("database:") for error in report.errors)
    assert _count(session_factory) == 0
