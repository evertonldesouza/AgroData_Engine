"""Database engine and session lifecycle."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError
from sqlalchemy.orm import Session, sessionmaker
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from agrodata.config import Settings
from agrodata.models import Base

logger = logging.getLogger(__name__)


def build_engine(settings: Settings) -> Engine:
    """Create an engine with sane pooling and fail-fast connectivity."""
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_recycle=1800,
        connect_args={
            "connect_timeout": settings.connect_timeout_seconds,
            # Ignored by SQLite (used by the test suite) through connect args filtering.
            "options": f"-c statement_timeout={settings.statement_timeout_ms}",
        }
        if settings.database_url.startswith("postgresql")
        else {},
        future=True,
    )


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


@contextmanager
def session_scope(factory: sessionmaker[Session]) -> Iterator[Session]:
    """Transactional scope: commit on success, roll back on error."""
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_schema(engine: Engine) -> None:
    """Create tables that do not exist yet.

    The .NET migration is the source of truth in deployed environments; this is
    a convenience for local databases and for bootstrapping the pipeline.
    """
    Base.metadata.create_all(bind=engine)


#: Errors that mean "the database is not reachable right now", not "the query is wrong".
TRANSIENT_ERRORS = (OperationalError, InterfaceError, DBAPIError)


def _ping(engine: Engine) -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def verify_connection(engine: Engine, *, attempts: int = 3, backoff_seconds: float = 0.5) -> None:
    """Raise when the database cannot be reached after ``attempts`` tries.

    A paused serverless instance (Supabase/Render free tiers) commonly refuses
    the first connection and accepts the next one a second later; that must not
    cost an entire ingestion hour.
    """
    ping = retry(
        reraise=True,
        stop=stop_after_attempt(max(1, attempts)),
        wait=wait_exponential(multiplier=max(0.01, backoff_seconds), max=8),
        retry=retry_if_exception_type(TRANSIENT_ERRORS),
    )(_ping)

    try:
        ping(engine)
    except TRANSIENT_ERRORS as exc:
        logger.error("Database is unreachable after %s attempts: %s", attempts, exc)
        raise


def is_database_reachable(
    engine: Engine, *, attempts: int = 1, backoff_seconds: float = 0.0
) -> bool:
    try:
        verify_connection(engine, attempts=attempts, backoff_seconds=backoff_seconds)
        return True
    except Exception:  # the caller only cares about the boolean
        return False


__all__ = [
    "TRANSIENT_ERRORS",
    "build_engine",
    "build_session_factory",
    "init_schema",
    "is_database_reachable",
    "session_scope",
    "verify_connection",
]
