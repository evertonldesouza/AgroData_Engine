from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
from pydantic import ValidationError

from agrodata.collectors import build_collector
from agrodata.collectors.cepea import (
    CEPEA_FALLBACK_URLS,
    CepeaCollector,
    CepeaParseError,
    extract_cells,
    parse_file,
    parse_number,
    parse_page,
)
from agrodata.config import Settings

FIXTURE = Path(__file__).parent / "fixtures" / "cepea_soja.html"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("136,42", 136.42),
        ("1.234,56", 1234.56),
        ("1.380,00", 1380.0),
        ("234", 234.0),
        (" 234,5 ", 234.5),
        ("\xa0234,5", 234.5),
    ],
)
def test_parse_number_accepts_brazilian_formatting(raw: str, expected: float) -> None:
    assert parse_number(raw) == pytest.approx(expected)


@pytest.mark.parametrize("raw", ["", "—", "-", "abc", "1,2,3", "12.34.56"])
def test_parse_number_rejects_garbage(raw: str) -> None:
    assert parse_number(raw) is None


def test_parse_page_reads_the_most_recent_quote() -> None:
    sample = parse_page(FIXTURE.read_text(encoding="utf-8"), "soja")

    assert sample is not None
    assert sample.symbol == "SOJA"
    assert sample.price == pytest.approx(136.42)
    assert sample.timestamp == datetime(2026, 10, 22, tzinfo=UTC)
    assert sample.source == "ESALQ/CEPEA"


def test_parse_page_skips_rows_without_a_value() -> None:
    html = FIXTURE.read_text(encoding="utf-8")
    rows = extract_cells(html)

    # Header row + four data rows are visible to the scraper.
    assert len(rows) == 5
    assert rows[0][0] == "Data"


def test_parse_page_returns_none_for_a_page_without_a_table(
    caplog: pytest.LogCaptureFixture,
) -> None:
    assert parse_page("<html><body>Em manuten&ccedil;&atilde;o</body></html>", "SOJA") is None
    assert "No table found" in caplog.text


def test_parse_page_returns_none_when_no_row_has_a_price(caplog: pytest.LogCaptureFixture) -> None:
    html = "<table><tr><td>22/10/2026</td><td>—</td></tr></table>"

    assert parse_page(html, "SOJA") is None
    assert "layout may have changed" in caplog.text


def test_parse_page_ignores_impossible_dates() -> None:
    html = "<table><tr><td>32/13/2026</td><td>10,00</td></tr></table>"

    assert parse_page(html, "SOJA") is None


def test_parse_file_reads_a_saved_page() -> None:
    sample = parse_file(str(FIXTURE), "SOJA")

    assert sample is not None
    assert sample.price == pytest.approx(136.42)


class _Session:
    """Minimal stand-in for ``requests.Session``."""

    def __init__(
        self, *, body: str = "", status: int = 200, error: Exception | None = None
    ) -> None:
        self.headers: dict[str, str] = {}
        self._body = body
        self._status = status
        self._error = error
        self.calls: list[str] = []

    def get(self, url: str, timeout: float | None = None) -> _Response:
        self.calls.append(url)
        if self._error is not None:
            raise self._error
        return _Response(self._status, self._body)


class _Response:
    def __init__(self, status_code: int, text: str) -> None:
        self.status_code = status_code
        self.text = text

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}", response=None)


def _collector(session: _Session, **kwargs: object) -> CepeaCollector:
    return CepeaCollector(
        urls={"SOJA": "https://example.test/soja"},
        session=session,  # type: ignore[arg-type]
        **kwargs,  # type: ignore[arg-type]
    )


def test_collector_parses_the_downloaded_page() -> None:
    session = _Session(body=FIXTURE.read_text(encoding="utf-8"))

    sample = _collector(session).collect("soja")

    assert sample is not None
    assert sample.price == pytest.approx(136.42)
    assert session.calls == ["https://example.test/soja"]


def test_collector_applies_the_source_label() -> None:
    session = _Session(body=FIXTURE.read_text(encoding="utf-8"))

    sample = _collector(session, source_label="CEPEA (cache)").collect("SOJA")

    assert sample is not None
    assert sample.source == "CEPEA (cache)"


def test_collector_retries_transient_failures() -> None:
    session = _Session(error=requests.Timeout("boom"))

    assert _collector(session, max_retries=3, backoff_seconds=0.01).collect("SOJA") is None
    assert len(session.calls) == 3


def test_collector_returns_none_on_http_errors() -> None:
    session = _Session(status=404, body="not found")

    assert _collector(session).collect("SOJA") is None


def test_collector_requires_a_known_symbol_when_no_template_is_given() -> None:
    collector = _collector(_Session(body=""))

    with pytest.raises(CepeaParseError, match="No CEPEA URL"):
        collector.url_for("CAFE")


def test_collector_builds_the_url_from_a_template() -> None:
    collector = _collector(_Session(body=""), url_template="https://example.test/{symbol}.aspx")

    assert collector.url_for("Soja") == "https://example.test/soja.aspx"


def test_factory_builds_the_cepea_collector() -> None:
    settings = Settings(data_source="cepea", database_url="sqlite://")

    collector = build_collector(settings)

    assert collector.name == "cepea"
    assert set(CEPEA_FALLBACK_URLS) >= {"SOJA", "MILHO"}


def test_cepea_source_requires_a_url_for_every_symbol() -> None:
    with pytest.raises(ValidationError, match="CEPEA_URL_TEMPLATE"):
        Settings(data_source="cepea", database_url="sqlite://", symbols=("CAFE",))


def test_cepea_source_accepts_unknown_symbols_with_a_template() -> None:
    settings = Settings(
        data_source="cepea",
        database_url="sqlite://",
        symbols=("CAFE",),
        cepea_url_template="https://example.test/{symbol}.aspx",
    )

    assert settings.symbols == ("CAFE",)
