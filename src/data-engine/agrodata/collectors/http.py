"""HTTP collector for a real market data provider.

Expected contract (documented in ``docs/api.md``)::

    GET {COMMODITY_API_URL}/{symbol}
    {
      "symbol": "SOJA",
      "price": 136.42,
      "timestamp": "2026-10-22T13:52:00Z",
      "source": "Provider Name"
    }

Transient failures (timeouts, 5xx) are retried with exponential backoff.
"""

from __future__ import annotations

import logging
from datetime import datetime

import requests
from pydantic import BaseModel, Field, ValidationError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from agrodata.schemas import PriceSample

logger = logging.getLogger(__name__)


class UpstreamError(RuntimeError):
    """Raised when the provider answers with an unusable payload."""


class _ProviderPayload(BaseModel):
    symbol: str = Field(min_length=1)
    price: float = Field(gt=0)
    timestamp: datetime | None = None
    source: str | None = None


class HttpCollector:
    """Thin, retrying client around the provider REST API."""

    name = "http"

    def __init__(
        self,
        *,
        base_url: str,
        source_label: str = "Market Provider",
        timeout_seconds: float = 8.0,
        max_retries: int = 3,
        backoff_seconds: float = 0.5,
        session: requests.Session | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._source_label = source_label
        self._timeout = timeout_seconds
        self._session = session or requests.Session()
        self._session.headers.update(
            {"Accept": "application/json", "User-Agent": "agrodata-engine/3.0"}
        )
        # Build the retry policy from settings; tenacity expects constant-ish fluent calls.
        self._request = retry(
            reraise=True,
            stop=stop_after_attempt(max_retries),
            wait=wait_exponential(multiplier=backoff_seconds or 0.01, max=8),
            retry=retry_if_exception_type((requests.Timeout, requests.ConnectionError)),
        )(self._fetch)

    def _fetch(self, symbol: str) -> dict[str, object]:
        response = self._session.get(f"{self._base_url}/{symbol}", timeout=self._timeout)
        if response.status_code >= 500:
            # Let tenacity retry server errors.
            raise requests.ConnectionError(f"upstream {response.status_code}")
        if response.status_code == 404:
            return {}
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            msg = f"unexpected payload type: {type(payload).__name__}"
            raise UpstreamError(msg)
        return payload

    def collect(self, symbol: str) -> PriceSample | None:
        symbol = symbol.strip().upper()
        try:
            payload = self._request(symbol)
            if not payload:
                logger.warning("Provider returned no data", extra={"symbol": symbol})
                return None
            parsed = _ProviderPayload.model_validate(payload)
            return PriceSample(
                symbol=parsed.symbol.upper(),
                price=parsed.price,
                timestamp=parsed.timestamp or datetime.now().astimezone(),
                source=parsed.source or self._source_label,
            )
        except (ValidationError, requests.RequestException, UpstreamError) as exc:
            logger.error("Collection failed", extra={"symbol": symbol, "error": str(exc)})
            return None


__all__ = ["HttpCollector", "UpstreamError"]
