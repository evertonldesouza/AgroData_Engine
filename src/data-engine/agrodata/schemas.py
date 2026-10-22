"""Transport objects shared by collectors and the pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass(frozen=True, slots=True)
class PriceSample:
    """A single validated price observation."""

    symbol: str
    price: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    source: str = "Simulated Market Data"

    def __post_init__(self) -> None:
        if not self.symbol or not self.symbol.strip():
            msg = "symbol must not be empty"
            raise ValueError(msg)
        if self.price <= 0:
            msg = f"price must be positive, got {self.price}"
            raise ValueError(msg)
        if self.timestamp.tzinfo is None:
            object.__setattr__(self, "timestamp", self.timestamp.replace(tzinfo=UTC))

    def as_row(self) -> dict[str, object]:
        return {
            "Symbol": self.symbol.strip().upper(),
            "Price": round(self.price, 2),
            "Timestamp": self.timestamp,
            "Source": self.source,
        }


__all__ = ["PriceSample"]
