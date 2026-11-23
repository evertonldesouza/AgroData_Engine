from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from agrodata.config import Settings
from agrodata.models import CommodityPrice
from agrodata.pipeline import run_pipeline
from agrodata.schemas import PriceSample


class StubCollector:
    name = "stub"

    def __init__(self, samples: dict[str, PriceSample | None]) -> None:
        self._samples = samples
        self.calls: list[str] = []

    def collect(self, symbol: str) -> PriceSample | None:
        self.calls.append(symbol)
        return self._samples.get(symbol)


class BoomCollector:
    name = "boom"

    def collect(self, symbol: str) -> PriceSample | None:
        raise RuntimeError(f"upstream down for {symbol}")


def _settings() -> Settings:
    return Settings(database_url="sqlite://", symbols=("SOJA", "MILHO"))


def _count(factory: sessionmaker[Session]) -> int:
    with factory() as session:
        return session.execute(select(func.count()).select_from(CommodityPrice)).scalar_one()


def test_pipeline_persists_one_row_per_symbol(session_factory: sessionmaker[Session]) -> None:
    collector = StubCollector(
        {
            "SOJA": PriceSample("SOJA", 136.42),
            "MILHO": PriceSample("MILHO", 58.10),
        }
    )

    report = run_pipeline(_settings(), collector, session_factory)

    assert report.ok
    assert report.inserted == 2
    assert report.skipped == 0
    assert report.duration_ms >= 0
    assert _count(session_factory) == 2


def test_dry_run_collects_without_writing(session_factory: sessionmaker[Session]) -> None:
    collector = StubCollector({"SOJA": PriceSample("SOJA", 136.42), "MILHO": None})

    report = run_pipeline(_settings(), collector, session_factory, dry_run=True)

    assert report.inserted == 0
    assert len(report.samples) == 1
    assert _count(session_factory) == 0
    assert report.errors == ["MILHO: no data returned"]


def test_pipeline_keeps_going_when_a_collector_raises(
    session_factory: sessionmaker[Session],
) -> None:
    report = run_pipeline(_settings(), BoomCollector(), session_factory)

    assert not report.ok
    assert report.inserted == 0
    assert len(report.errors) == 2
    assert all("upstream down" in error for error in report.errors)


def test_duplicate_quotes_are_skipped_inside_the_window(
    session_factory: sessionmaker[Session],
) -> None:
    now = datetime.now(UTC)
    collector = StubCollector({"SOJA": PriceSample("SOJA", 136.42, now), "MILHO": None})

    first = run_pipeline(
        _settings(), collector, session_factory, symbols=("SOJA",), dedupe_window_seconds=300
    )
    second = run_pipeline(
        _settings(), collector, session_factory, symbols=("SOJA",), dedupe_window_seconds=300
    )

    assert first.inserted == 1
    assert second.inserted == 0
    assert second.skipped == 1
    assert _count(session_factory) == 1


def test_custom_symbols_override_settings(session_factory: sessionmaker[Session]) -> None:
    collector = StubCollector({"CAFE": PriceSample("CAFE", 210.5)})

    report = run_pipeline(_settings(), collector, session_factory, symbols=("CAFE",))

    assert collector.calls == ["CAFE"]
    assert report.inserted == 1


def test_report_serialisation_is_json_friendly(session_factory: sessionmaker[Session]) -> None:
    report = run_pipeline(
        _settings(),
        StubCollector({"SOJA": PriceSample("SOJA", 1.0), "MILHO": PriceSample("MILHO", 2.0)}),
        session_factory,
    )

    payload = report.as_dict()

    assert payload["inserted"] == 2
    assert payload["ok"] is True
    assert payload["durationMs"] >= 0
    assert isinstance(payload["startedAt"], str)


def test_negative_or_zero_prices_are_rejected() -> None:
    with pytest.raises(ValueError, match="price must be positive"):
        PriceSample("SOJA", 0)
