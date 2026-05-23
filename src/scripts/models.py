from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime, timezone
from database import Base


class CommodityPrice(Base):
    __tablename__ = 'Commodities'

    Id = Column(Integer, primary_key=True, autoincrement=True)
    Symbol = Column(String, nullable=False, index=True)
    Price = Column(Float, nullable=False)
    Timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    Source = Column(String)

    def __repr__(self) -> str:
        return f"<CommodityPrice(Symbol='{self.Symbol}', Price={self.Price})>"
