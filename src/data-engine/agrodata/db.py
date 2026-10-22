"""Database engine and session lifecycle."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

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


def is_database_reachable(engine: Engine) -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # pragma: no cover - depends on infra
        logger.error("Database connectivity check failed: %s", exc)
        return False


__all__ = [
    "build_engine",
    "build_session_factory",
    "init_schema",
    "is_database_reachable",
    "session_scope",
]
