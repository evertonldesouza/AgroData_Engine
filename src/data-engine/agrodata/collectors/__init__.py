"""Collector protocol plus factory."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from agrodata.config import Settings
from agrodata.schemas import PriceSample


@runtime_checkable
class PriceCollector(Protocol):
    """A source of commodity prices."""

    name: str

    def collect(self, symbol: str) -> PriceSample | None:
        """Return a sample for ``symbol`` or ``None`` when the source has no data."""
        ...


def build_collector(settings: Settings) -> PriceCollector:
    """Instantiate the collector selected by ``DATA_SOURCE``."""
    if settings.data_source == "http":
        from agrodata.collectors.http import HttpCollector

        assert settings.commodity_api_url is not None  # validated in Settings
        return HttpCollector(
            base_url=settings.commodity_api_url,
            source_label=settings.source_label,
            timeout_seconds=settings.http_timeout_seconds,
            max_retries=settings.max_retries,
            backoff_seconds=settings.retry_backoff_seconds,
        )

    from agrodata.collectors.simulated import SimulatedCollector

    return SimulatedCollector(source_label=settings.source_label, seed=settings.random_seed)


__all__ = ["PriceCollector", "build_collector"]
