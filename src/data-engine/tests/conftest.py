from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from agrodata.db import init_schema
from agrodata.models import Base


@pytest.fixture
def session_factory() -> Iterator[sessionmaker[Session]]:
    """In-memory SQLite database isolated per test."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    init_schema(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, future=True)
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()
