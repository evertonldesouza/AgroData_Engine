"""Collector for the public ESALQ/CEPEA indicator pages.

CEPEA does not publish a documented API for the free indicators, so this module
parses the HTML table of a commodity page (``/br/indicador/soja.aspx``).

Two rules keep the parse honest:

1. **Never guess a price.** If the table or the value cannot be found, the
   collector returns ``None`` and logs why — a wrong number in a price warehouse
   is worse than a missing one.
2. **Be verifiable offline.** ``agrodata verify-source --html page.html`` runs the
   exact same parser against a saved page, so a layout change can be diagnosed
   without hitting the network or touching the database.

The sample fixture in ``tests/fixtures/cepea_soja.html`` mirrors the published
table structure; it is synthetic, not a verbatim copy of the site.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime

import requests
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from agrodata.config import CEPEA_URLS
from agrodata.schemas import PriceSample

logger = logging.getLogger(__name__)

#: Matches "1.234,56" and "234,56" (Brazilian formatting).
_PT_BR_NUMBER = re.compile(r"^\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^\d+(?:,\d+)?$")
#: Isolates table rows and their cells without pulling in a DOM parser.
_ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.IGNORECASE | re.DOTALL)
_CELL = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.IGNORECASE | re.DOTALL)
_TAGS = re.compile(r"<[^>]+>")
_DATE = re.compile(r"(\d{2})/(\d{2})/(\d{4})")

#: Column index of the indicator value on the CEPEA table (date, value, ...).
_VALUE_COLUMN = 1


#: Default pages, kept here so the collector can be built without Settings.
CEPEA_FALLBACK_URLS: dict[str, str] = CEPEA_URLS


class CepeaParseError(RuntimeError):
    """Raised when the page does not look like a CEPEA indicator table."""


def parse_number(text: str) -> float | None:
    """Convert a Brazilian formatted number into a float.

    >>> parse_number("1.234,56")
    1234.56
    >>> parse_number("234,5")
    234.5
    >>> parse_number("—") is None
    True
    """
    cleaned = text.strip().replace("\xa0", " ").replace(" ", "")
    if not cleaned or not _PT_BR_NUMBER.match(cleaned):
        return None

    return float(cleaned.replace(".", "").replace(",", "."))


def extract_cells(html: str) -> list[list[str]]:
    """Return the table as rows of plain-text cells."""
    rows: list[list[str]] = []
    for row_html in _ROW.findall(html):
        cells = [_TAGS.sub("", cell).strip() for cell in _CELL.findall(row_html)]
        if cells:
            rows.append(cells)
    return rows


def parse_page(html: str, symbol: str) -> PriceSample | None:
    """Extract the most recent indicator value from a CEPEA page."""
    rows = extract_cells(html)
    if not rows:
        logger.error("No table found on the CEPEA page", extra={"symbol": symbol})
        return None

    for row in rows:
        if len(row) <= _VALUE_COLUMN:
            continue

        match = _DATE.match(row[0])
        price = parse_number(row[_VALUE_COLUMN])
        if not match or price is None or price <= 0:
            continue

        day, month, year = (int(part) for part in match.groups())
        try:
            timestamp = datetime(year, month, day, tzinfo=UTC)
        except ValueError:
            logger.debug("Ignoring an impossible date", extra={"symbol": symbol, "raw": row[0]})
            continue

        logger.info(
            "Parsed CEPEA indicator",
            extra={"symbol": symbol, "price": price, "date": timestamp.date().isoformat()},
        )
        return PriceSample(
            symbol=symbol.upper(),
            price=price,
            timestamp=timestamp,
            source="ESALQ/CEPEA",
        )

    logger.warning(
        "No priced row found — the page layout may have changed",
        extra={"symbol": symbol, "rows": len(rows)},
    )
    return None


class CepeaCollector:
    """Fetches a CEPEA indicator page and parses its latest value."""

    name = "cepea"

    def __init__(
        self,
        *,
        urls: dict[str, str],
        url_template: str | None = None,
        source_label: str = "ESALQ/CEPEA",
        timeout_seconds: float = 15.0,
        max_retries: int = 3,
        backoff_seconds: float = 0.5,
        session: requests.Session | None = None,
    ) -> None:
        self._urls = {symbol.upper(): url for symbol, url in urls.items()}
        self._url_template = url_template
        self._source_label = source_label
        self._timeout = timeout_seconds
        self._session = session or requests.Session()
        self._session.headers.update(
            {
                "Accept": "text/html,application/xhtml+xml",
                "User-Agent": "agrodata-engine/3.0 (+https://github.com/evertonldesouza/AgroData_Engine)",
            }
        )
        self._fetch = retry(
            reraise=True,
            stop=stop_after_attempt(max(1, max_retries)),
            wait=wait_exponential(multiplier=max(0.01, backoff_seconds), max=8),
            retry=retry_if_exception_type((requests.Timeout, requests.ConnectionError)),
        )(self._download)

    def url_for(self, symbol: str) -> str:
        """Resolve the page URL of a symbol."""
        upper = symbol.upper()
        if self._url_template:
            return self._url_template.format(symbol=upper.lower(), SYMBOL=upper)
        if upper not in self._urls:
            raise CepeaParseError(f"No CEPEA URL is known for {upper}.")
        return self._urls[upper]

    def _download(self, url: str) -> str:
        response = self._session.get(url, timeout=self._timeout)
        if response.status_code >= 500:
            raise requests.ConnectionError(f"upstream {response.status_code}")
        response.raise_for_status()
        return response.text

    def collect(self, symbol: str) -> PriceSample | None:
        symbol = symbol.strip().upper()
        try:
            html = self._fetch(self.url_for(symbol))
        except (requests.RequestException, CepeaParseError) as exc:
            logger.error("CEPEA request failed", extra={"symbol": symbol, "error": str(exc)})
            return None

        sample = parse_page(html, symbol)
        if sample is not None and self._source_label != "ESALQ/CEPEA":
            sample = PriceSample(
                symbol=sample.symbol,
                price=sample.price,
                timestamp=sample.timestamp,
                source=self._source_label,
            )
        return sample


def parse_file(path: str, symbol: str) -> PriceSample | None:
    """Parse a saved page. Used by ``agrodata verify-source --html``."""
    with open(path, encoding="utf-8") as handle:
        return parse_page(handle.read(), symbol)


__all__ = [
    "CEPEA_FALLBACK_URLS",
    "CepeaCollector",
    "CepeaParseError",
    "extract_cells",
    "parse_file",
    "parse_number",
    "parse_page",
]
