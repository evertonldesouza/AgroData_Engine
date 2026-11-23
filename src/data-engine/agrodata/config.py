"""Typed, validated application settings.

Everything the engine needs comes from environment variables (or a ``.env``
file). Failures are explicit and happen at start-up, never halfway through a
pipeline run.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

DEFAULT_SYMBOLS: tuple[str, ...] = ("SOJA", "MILHO")

#: Public ESALQ/CEPEA indicator pages, one per commodity.
CEPEA_URLS: dict[str, str] = {
    "SOJA": "https://www.cepea.esalq.usp.br/br/indicador/soja.aspx",
    "MILHO": "https://www.cepea.esalq.usp.br/br/indicador/milho.aspx",
}


class Settings(BaseSettings):
    """Runtime configuration for the data engine."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = Field(
        ...,
        description="SQLAlchemy URL of the PostgreSQL warehouse.",
        examples=["postgresql://user:pass@host:5432/agrodata"],
    )
    data_source: Literal["simulated", "http", "cepea"] = Field(
        default="simulated",
        description="Which collector implementation to use.",
    )
    commodity_api_url: str | None = Field(
        default=None,
        description="Base URL used by the HTTP collector.",
    )
    cepea_url_template: str | None = Field(
        default=None,
        description=(
            "Optional URL template for the CEPEA collector, e.g. "
            "'https://www.cepea.esalq.usp.br/br/indicador/{symbol}.aspx'. "
            "When omitted, the documented per-symbol URLs are used."
        ),
    )
    symbols: Annotated[tuple[str, ...], NoDecode] = Field(
        default=DEFAULT_SYMBOLS,
        description="Symbols to ingest. Accepts a comma separated env var.",
    )
    source_label: str = Field(
        default="Simulated Market Data",
        description="Value written to the Source column.",
        max_length=120,
    )
    http_timeout_seconds: float = Field(default=8.0, gt=0, le=60)
    max_retries: int = Field(default=3, ge=1, le=10)
    retry_backoff_seconds: float = Field(default=0.5, ge=0, le=30)
    connect_timeout_seconds: int = Field(default=10, ge=1, le=120)
    db_connect_attempts: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Attempts used when opening a connection before failing the run.",
    )
    db_retry_backoff_seconds: float = Field(default=0.5, ge=0, le=30)
    statement_timeout_ms: int = Field(default=30_000, ge=1_000)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_json: bool = False
    random_seed: int = Field(
        default=42,
        description="Seed used by the simulated collector for reproducible runs.",
    )

    @field_validator("symbols", mode="before")
    @classmethod
    def _split_symbols(cls, value: object) -> object:
        if isinstance(value, str):
            parsed = tuple(part.strip().upper() for part in value.split(",") if part.strip())
            return parsed or DEFAULT_SYMBOLS
        return value

    @field_validator("database_url")
    @classmethod
    def _require_postgres(cls, value: str) -> str:
        if not value:
            msg = "DATABASE_URL is empty. Set it in the environment or in a .env file."
            raise ValueError(msg)
        return value

    @model_validator(mode="after")
    def _validate_http_source(self) -> Settings:
        if self.data_source == "http" and not self.commodity_api_url:
            msg = "DATA_SOURCE=http requires COMMODITY_API_URL to be set."
            raise ValueError(msg)
        if self.data_source == "cepea":
            missing = [symbol for symbol in self.symbols if symbol not in CEPEA_URLS]
            if missing and not self.cepea_url_template:
                msg = (
                    "DATA_SOURCE=cepea has no default URL for: "
                    f"{', '.join(missing)}. Set CEPEA_URL_TEMPLATE or restrict SYMBOLS."
                )
                raise ValueError(msg)
        return self

    @property
    def masked_database_url(self) -> str:
        """Return the database URL with the password replaced by ``***``."""
        url = self.database_url
        if "://" not in url:
            return url
        scheme, rest = url.split("://", 1)
        if "@" not in rest:
            return url
        credentials, host = rest.rsplit("@", 1)
        user = credentials.split(":", 1)[0]
        return f"{scheme}://{user}:***@{host}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached ``Settings`` instance."""
    return Settings()  # type: ignore[call-arg]
