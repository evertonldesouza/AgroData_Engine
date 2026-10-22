"""AgroData Engine — commodity ingestion and analytics pipeline.

The package is intentionally split into small, testable units:

``config``      typed settings loaded from the environment
``db``          engine/session lifecycle
``models``      SQLAlchemy mapping shared with the .NET API
``collectors``  price sources (simulated or HTTP)
``pipeline``    orchestration: collect -> validate -> persist
``analytics``   moving averages and trend classification
``cli``         command line entry point (``python -m agrodata``)
"""

from importlib.metadata import PackageNotFoundError, version

try:  # pragma: no cover - metadata is available in installed environments
    __version__ = version("agrodata-engine")
except PackageNotFoundError:  # pragma: no cover - fallback for source checkouts
    __version__ = "3.0.0"

__all__ = ["__version__"]
