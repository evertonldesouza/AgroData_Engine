from __future__ import annotations

import requests

from agrodata.collectors import build_collector
from agrodata.collectors.http import HttpCollector
from agrodata.collectors.simulated import SimulatedCollector
from agrodata.config import Settings


def test_simulated_collector_is_deterministic_for_a_seed() -> None:
    first = [SimulatedCollector(seed=7).collect(s) for s in ("SOJA", "MILHO")]
    second = [SimulatedCollector(seed=7).collect(s) for s in ("SOJA", "MILHO")]

    assert [sample.price if sample else None for sample in first] == [
        sample.price if sample else None for sample in second
    ]


def test_simulated_collector_stays_close_to_the_reference_price() -> None:
    collector = SimulatedCollector(seed=1)

    prices = [collector.collect("SOJA").price for _ in range(200)]  # type: ignore[union-attr]

    assert all(price > 0 for price in prices)
    assert min(prices) > 100
    assert max(prices) < 175


def test_simulated_collector_can_fail_on_purpose() -> None:
    collector = SimulatedCollector(failure_rate=1.0)
    assert collector.collect("SOJA") is None


class _FakeResponse:
    def __init__(self, status_code: int, payload: object | None = None) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> object:
        return self._payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}", response=None)


class _FakeSession:
    def __init__(self, responses: list[_FakeResponse]) -> None:
        self._responses = responses
        self.headers: dict[str, str] = {}
        self.calls = 0

    def get(self, url: str, timeout: float) -> _FakeResponse:
        self.calls += 1
        return self._responses[min(self.calls - 1, len(self._responses) - 1)]


def _collector(session: _FakeSession, retries: int = 3) -> HttpCollector:
    return HttpCollector(
        base_url="https://provider.test/v1/commodities",
        session=session,  # type: ignore[arg-type]
        max_retries=retries,
        backoff_seconds=0.01,
        timeout_seconds=1,
    )


def test_http_collector_parses_provider_payload() -> None:
    session = _FakeSession(
        [
            _FakeResponse(
                200,
                {
                    "symbol": "soja",
                    "price": 141.37,
                    "timestamp": "2026-10-22T12:00:00Z",
                    "source": "Provider",
                },
            )
        ]
    )

    sample = _collector(session).collect("SOJA")

    assert sample is not None
    assert sample.symbol == "SOJA"
    assert sample.price == 141.37
    assert sample.source == "Provider"
    assert sample.timestamp.year == 2026


def test_http_collector_returns_none_on_404() -> None:
    session = _FakeSession([_FakeResponse(404, {})])
    assert _collector(session).collect("CAFE") is None


def test_http_collector_retries_server_errors() -> None:
    session = _FakeSession([_FakeResponse(503, {}), _FakeResponse(500, {})])

    assert _collector(session, retries=2).collect("SOJA") is None
    assert session.calls == 2


def test_http_collector_rejects_invalid_payloads() -> None:
    session = _FakeSession([_FakeResponse(200, {"symbol": "SOJA", "price": -3})])

    assert _collector(session).collect("SOJA") is None


def test_http_collector_handles_non_object_payloads() -> None:
    session = _FakeSession([_FakeResponse(200, [1, 2, 3])])

    assert _collector(session).collect("SOJA") is None


def test_factory_builds_the_configured_collector() -> None:
    simulated = build_collector(Settings(database_url="sqlite://"))
    http = build_collector(
        Settings(
            database_url="sqlite://",
            data_source="http",
            commodity_api_url="https://provider.test/v1",
        )
    )

    assert isinstance(simulated, SimulatedCollector)
    assert isinstance(http, HttpCollector)
