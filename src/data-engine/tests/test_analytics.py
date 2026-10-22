from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pandas as pd
import pytest
from sqlalchemy.orm import Session, sessionmaker

from agrodata.analytics import build_frame, compute_trends, load_frame
from agrodata.models import CommodityPrice


def _frame(prices: list[float], symbol: str = "SOJA") -> pd.DataFrame:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    rows = [(symbol, price, start + timedelta(hours=i)) for i, price in enumerate(prices)]
    return build_frame(rows)


def test_empty_frame_has_no_trends() -> None:
    assert compute_trends(build_frame([])) == []


def test_rising_prices_are_classified_as_up() -> None:
    [summary] = compute_trends(_frame([100.0, 101.0, 102.0, 103.0]), window=3)

    assert summary.symbol == "SOJA"
    assert summary.direction == "up"
    assert summary.moving_average == pytest.approx(102.0)
    assert summary.samples == 4


def test_falling_prices_are_classified_as_down() -> None:
    [summary] = compute_trends(_frame([110.0, 108.0, 106.0, 104.0]), window=3)

    assert summary.direction == "down"


def test_stable_prices_are_classified_as_flat() -> None:
    [summary] = compute_trends(_frame([100.0, 100.0, 100.01, 100.0]), window=3)

    assert summary.direction == "flat"


def test_moving_average_is_unavailable_below_min_samples() -> None:
    [summary] = compute_trends(_frame([100.0, 101.0]), window=7)

    assert summary.moving_average is None
    assert summary.direction == "flat"


def test_symbols_are_reported_independently() -> None:
    soja = _frame([100.0, 102.0, 104.0], symbol="SOJA")
    milho = _frame([60.0, 59.0, 58.0], symbol="MILHO")

    summaries = {item.symbol: item for item in compute_trends(pd.concat([soja, milho]), window=3)}

    assert summaries["SOJA"].direction == "up"
    assert summaries["MILHO"].direction == "down"


def test_invalid_window_is_rejected() -> None:
    with pytest.raises(ValueError, match="window"):
        compute_trends(_frame([1.0]), window=0)


def test_load_frame_reads_and_filters_the_warehouse(
    session_factory: sessionmaker[Session],
) -> None:
    start = datetime(2026, 3, 1, tzinfo=UTC)
    with session_factory() as session:
        session.add_all(
            [
                CommodityPrice(symbol="SOJA", price=100.0, timestamp=start, source="test"),
                CommodityPrice(symbol="SOJA", price=101.0, timestamp=start, source="test"),
                CommodityPrice(symbol="MILHO", price=60.0, timestamp=start, source="test"),
            ]
        )
        session.commit()

        assert len(load_frame(session)) == 3
        filtered = load_frame(session, symbols=["soja"])
        assert set(filtered["symbol"]) == {"SOJA"}


def test_summary_serialisation_uses_camel_case() -> None:
    [summary] = compute_trends(_frame([100.0, 100.0, 100.0]), window=3)

    payload = summary.as_dict()

    assert payload["movingAverage"] == 100.0
    assert payload["latestPrice"] == 100.0
    assert "asOf" in payload
