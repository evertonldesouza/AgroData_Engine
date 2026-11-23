"""Moving averages and trend classification.

``pandas`` does the heavy lifting; this module owns the business rules so the
API, the CLI and the tests all agree on what "up" means.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Literal

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from agrodata.models import CommodityPrice

logger = logging.getLogger(__name__)

Direction = Literal["up", "down", "flat"]

DEFAULT_WINDOW = 7
MIN_SAMPLES = 3
#: Relative difference below which prices are considered stable (0.1%).
FLAT_THRESHOLD = 0.001


@dataclass(frozen=True, slots=True)
class TrendSummary:
    """Trend snapshot for a single symbol."""

    symbol: str
    latest_price: float
    moving_average: float | None
    direction: Direction
    samples: int
    window: int
    as_of: datetime | None

    def as_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload["asOf"] = payload.pop("as_of")
        payload["movingAverage"] = payload.pop("moving_average")
        payload["latestPrice"] = payload.pop("latest_price")
        return payload


def build_frame(rows: Iterable[tuple[str, float, datetime]]) -> pd.DataFrame:
    """Build a typed frame from ``(symbol, price, timestamp)`` tuples."""
    frame = pd.DataFrame(list(rows), columns=["symbol", "price", "timestamp"])
    if frame.empty:
        return frame
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    frame["price"] = frame["price"].astype(float)
    return frame


def load_frame(session: Session, symbols: Sequence[str] | None = None) -> pd.DataFrame:
    """Load price history from the warehouse into a frame."""
    stmt = select(CommodityPrice.symbol, CommodityPrice.price, CommodityPrice.timestamp)
    if symbols:
        stmt = stmt.where(CommodityPrice.symbol.in_([s.upper() for s in symbols]))
    stmt = stmt.order_by(CommodityPrice.timestamp)
    return build_frame(session.execute(stmt).all())


def compute_trends(frame: pd.DataFrame, window: int = DEFAULT_WINDOW) -> list[TrendSummary]:
    """Classify the latest price of every symbol against its moving average."""
    if window < 1:
        msg = "window must be >= 1"
        raise ValueError(msg)
    if frame.empty:
        return []

    summaries: list[TrendSummary] = []
    for symbol, group in frame.sort_values("timestamp").groupby("symbol", sort=True):
        rolling = group["price"].rolling(window=window, min_periods=min(MIN_SAMPLES, window)).mean()
        latest = group.iloc[-1]
        moving_average = rolling.iloc[-1]

        direction: Direction = "flat"
        if not pd.isna(moving_average):
            delta = float(latest["price"]) - float(moving_average)
            if abs(delta) / float(moving_average) > FLAT_THRESHOLD:
                direction = "up" if delta > 0 else "down"

        summaries.append(
            TrendSummary(
                symbol=str(symbol),
                latest_price=float(latest["price"]),
                moving_average=None if pd.isna(moving_average) else round(float(moving_average), 2),
                direction=direction,
                samples=len(group),
                window=window,
                as_of=latest["timestamp"].to_pydatetime(),
            )
        )

    logger.debug("Computed trends", extra={"symbols": len(summaries), "window": window})
    return summaries


def analyze(session: Session, window: int = DEFAULT_WINDOW) -> list[TrendSummary]:
    """Convenience wrapper: load the warehouse and classify trends."""
    return compute_trends(load_frame(session), window=window)


__all__ = [
    "DEFAULT_WINDOW",
    "FLAT_THRESHOLD",
    "MIN_SAMPLES",
    "TrendSummary",
    "analyze",
    "build_frame",
    "compute_trends",
    "load_frame",
]
