"""SQLAlchemy mappings for the warehouse.

Column names are PascalCase on purpose: they match the EF Core migration that
owns the schema (``AgroData.Infrastructure/Migrations``), so both runtimes can
read the same table without a translation layer.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base shared by every model in the warehouse."""


class CommodityPrice(Base):
    __tablename__ = "Commodities"

    id: Mapped[int] = mapped_column("Id", Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column("Symbol", String, nullable=False, index=True)
    price: Mapped[float] = mapped_column("Price", Float, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        "Timestamp",
        DateTime(timezone=True),
        nullable=False,
        index=True,
        default=lambda: datetime.now(UTC),
    )
    source: Mapped[str] = mapped_column(
        "Source", String, nullable=False, default="Simulated Market Data"
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<CommodityPrice(symbol={self.symbol!r}, price={self.price})>"


__all__ = ["Base", "CommodityPrice"]
