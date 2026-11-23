"""Deterministic, mean-reverting price simulator.

The simulator replaces a paid market data feed in demos. It is seeded, so the
same run always produces the same series — which makes tests and screenshots
reproducible.
"""

from __future__ import annotations

import logging
import random

from agrodata.schemas import PriceSample

logger = logging.getLogger(__name__)

BASE_PRICES: dict[str, float] = {"SOJA": 136.0, "MILHO": 58.0}


class SimulatedCollector:
    """Mean-reverting random walk around a per-symbol reference price."""

    name = "simulated"

    def __init__(
        self,
        *,
        source_label: str = "Simulated Market Data",
        seed: int = 42,
        volatility: float = 0.009,
        failure_rate: float = 0.0,
        base_prices: dict[str, float] | None = None,
    ) -> None:
        self._source_label = source_label
        self._random = random.Random(seed)
        self._volatility = volatility
        self._failure_rate = failure_rate
        self._base_prices = {**BASE_PRICES, **(base_prices or {})}
        self._last_prices: dict[str, float] = {}

    def collect(self, symbol: str) -> PriceSample | None:
        symbol = symbol.strip().upper()
        if self._failure_rate and self._random.random() < self._failure_rate:
            logger.warning("Simulated upstream failure", extra={"symbol": symbol})
            return None

        reference = self._base_prices.get(symbol, 100.0)
        previous = self._last_prices.get(symbol, reference)

        # Pull gently back to the reference price, then add noise.
        drift = (reference - previous) * 0.08
        noise = self._random.gauss(0.0, reference * self._volatility)
        price = max(0.01, round(previous + drift + noise, 2))
        self._last_prices[symbol] = price

        return PriceSample(symbol=symbol, price=price, source=self._source_label)


__all__ = ["BASE_PRICES", "SimulatedCollector"]
