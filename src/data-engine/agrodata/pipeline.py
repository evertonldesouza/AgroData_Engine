"""Ingestion orchestration: collect → validate → persist.

The pipeline is deliberately dependency-injected (collector + session factory)
so the whole flow can be exercised against SQLite in tests.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from agrodata.collectors import PriceCollector
from agrodata.config import Settings
from agrodata.db import TRANSIENT_ERRORS
from agrodata.models import CommodityPrice
from agrodata.schemas import PriceSample

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class PipelineReport:
    """Outcome of a pipeline run."""

    started_at: datetime
    finished_at: datetime
    inserted: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    samples: list[PriceSample] = field(default_factory=list)

    @property
    def duration_ms(self) -> int:
        return int((self.finished_at - self.started_at).total_seconds() * 1000)

    @property
    def ok(self) -> bool:
        return not self.errors

    def as_dict(self) -> dict[str, object]:
        return {
            "startedAt": self.started_at.isoformat(),
            "finishedAt": self.finished_at.isoformat(),
            "durationMs": self.duration_ms,
            "inserted": self.inserted,
            "skipped": self.skipped,
            "errors": self.errors,
            "ok": self.ok,
        }


def _is_duplicate(session: Session, sample: PriceSample, *, window_seconds: int) -> bool:
    """True when an identical quote for the symbol was stored recently."""
    if window_seconds <= 0:
        return False
    cutoff = sample.timestamp - timedelta(seconds=window_seconds)
    stmt = (
        select(func.count())
        .select_from(CommodityPrice)
        .where(
            CommodityPrice.symbol == sample.symbol.upper(),
            CommodityPrice.timestamp >= cutoff,
            CommodityPrice.price == round(sample.price, 2),
        )
    )
    return bool(session.execute(stmt).scalar_one())


def _persist(
    session: Session,
    samples: list[PriceSample],
    *,
    attempts: int,
    backoff_seconds: float,
) -> None:
    """Insert every sample, retrying transient connection failures.

    A failed commit leaves the session unusable, so each attempt starts with a
    rollback and re-adds the rows. Retrying the *whole* write (instead of just
    ``commit``) is what makes the retry safe.
    """

    def attempt() -> None:
        session.rollback()
        session.add_all(
            [
                CommodityPrice(
                    symbol=sample.symbol.upper(),
                    price=round(sample.price, 2),
                    timestamp=sample.timestamp,
                    source=sample.source,
                )
                for sample in samples
            ]
        )
        session.commit()

    write = retry(
        reraise=True,
        stop=stop_after_attempt(max(1, attempts)),
        wait=wait_exponential(multiplier=max(0.01, backoff_seconds), max=8),
        retry=retry_if_exception_type(TRANSIENT_ERRORS),
    )(attempt)

    try:
        write()
    except TRANSIENT_ERRORS:
        logger.exception("Persisting failed after %s attempts", attempts)
        raise


def run_pipeline(
    settings: Settings,
    collector: PriceCollector,
    session_factory: sessionmaker[Session],
    *,
    symbols: tuple[str, ...] | None = None,
    dedupe_window_seconds: int = 0,
    dry_run: bool = False,
) -> PipelineReport:
    """Collect one sample per symbol and persist it."""
    started = datetime.now(UTC)
    report = PipelineReport(started_at=started, finished_at=started)
    targets = symbols or settings.symbols

    logger.info(
        "Pipeline started",
        extra={"collector": collector.name, "symbols": list(targets), "dryRun": dry_run},
    )

    persisted = False

    with session_factory() as session:
        for symbol in targets:
            try:
                sample = collector.collect(symbol)
            except Exception as exc:  # defensive: a broken collector must not kill the run
                logger.exception("Collector raised", extra={"symbol": symbol})
                report.errors.append(f"{symbol}: {exc}")
                continue

            if sample is None:
                report.errors.append(f"{symbol}: no data returned")
                continue

            if _is_duplicate(session, sample, window_seconds=dedupe_window_seconds):
                logger.info("Skipping duplicate quote", extra={"symbol": symbol})
                report.skipped += 1
                continue

            report.samples.append(sample)

        if dry_run:
            session.rollback()
        elif report.samples:
            try:
                _persist(
                    session,
                    report.samples,
                    attempts=settings.db_connect_attempts,
                    backoff_seconds=settings.db_retry_backoff_seconds,
                )
                persisted = True
            except TRANSIENT_ERRORS as exc:
                report.errors.append(f"database: {exc}")

    report.finished_at = datetime.now(UTC)
    # `inserted` reflects what actually reached the warehouse: a dry run writes
    # nothing and a failed write must not be reported as a success.
    report.inserted = len(report.samples) if persisted else 0
    logger.info("Pipeline finished", extra=report.as_dict())
    return report


__all__ = ["PipelineReport", "run_pipeline"]
