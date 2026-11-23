"""Command line interface: ``python -m agrodata <command>``.

Exit codes follow the usual convention: 0 success, 1 runtime failure,
2 invalid configuration or arguments.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections.abc import Sequence

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from agrodata import __version__
from agrodata.analytics import DEFAULT_WINDOW, analyze
from agrodata.collectors import build_collector
from agrodata.config import Settings, get_settings
from agrodata.db import (
    build_engine,
    build_session_factory,
    init_schema,
    is_database_reachable,
)
from agrodata.logging import configure_logging
from agrodata.models import CommodityPrice
from agrodata.pipeline import run_pipeline

logger = logging.getLogger("agrodata.cli")


def _parse_symbols(value: str | None) -> tuple[str, ...] | None:
    if not value:
        return None
    symbols = tuple(part.strip().upper() for part in value.split(",") if part.strip())
    return symbols or None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="agrodata",
        description="AgroData Engine — commodity ingestion and analytics.",
    )
    parser.add_argument("--json", action="store_true", default=None, help="emit JSON output")
    parser.add_argument("--log-level", default=None, help="override LOG_LEVEL")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_common(subparser: argparse.ArgumentParser) -> None:
        subparser.add_argument(
            "--json", action="store_true", default=None, help="emit machine readable JSON"
        )

    collect = subparsers.add_parser("collect", help="collect and persist a new price snapshot")
    add_common(collect)
    collect.add_argument("--symbols", help="comma separated symbols (default: settings)")
    collect.add_argument("--dry-run", action="store_true", help="collect without writing")
    collect.add_argument(
        "--dedupe-window",
        type=int,
        default=0,
        metavar="SECONDS",
        help="skip quotes identical to one stored within this window",
    )

    analytics = subparsers.add_parser("analyze", help="print moving average trends")
    add_common(analytics)
    analytics.add_argument("--window", type=int, default=DEFAULT_WINDOW)

    init_db = subparsers.add_parser("init-db", help="create missing tables (local development)")
    add_common(init_db)
    check = subparsers.add_parser("check", help="verify configuration and database connectivity")
    add_common(check)

    verify = subparsers.add_parser(
        "verify-source",
        help="parse a saved CEPEA page offline (diagnose layout changes)",
    )
    add_common(verify)
    verify.add_argument("--html", required=True, help="path to a saved indicator page")
    verify.add_argument("--symbol", required=True, help="symbol the page belongs to")
    subparsers.add_parser("version", help="print the engine version")
    return parser


def _load_settings(overrides: dict[str, object]) -> Settings | None:
    try:
        settings = get_settings()
    except ValidationError as exc:
        print(f"configuration error:\n{exc}", file=sys.stderr)
        return None
    clean = {key: value for key, value in overrides.items() if value is not None}
    return settings.model_copy(update=clean) if clean else settings


def _emit(payload: dict[str, object], *, as_json: bool, text: str) -> None:
    print(json.dumps(payload, indent=2, default=str) if as_json else text)


def _collect(
    args: argparse.Namespace, settings: Settings, session_factory: sessionmaker[Session]
) -> int:
    collector = build_collector(settings)
    report = run_pipeline(
        settings,
        collector,
        session_factory,
        symbols=_parse_symbols(args.symbols),
        dedupe_window_seconds=args.dedupe_window,
        dry_run=args.dry_run,
    )
    text = "\n".join(
        [
            f"collector : {collector.name}",
            f"inserted  : {report.inserted}",
            f"skipped   : {report.skipped}",
            f"errors    : {len(report.errors)}",
            f"duration  : {report.duration_ms} ms",
            *(f"  ! {error}" for error in report.errors),
        ]
    )
    _emit(report.as_dict(), as_json=args.json, text=text)
    return 0 if report.ok else 1


def _analyze(args: argparse.Namespace, session_factory: sessionmaker[Session]) -> int:
    with session_factory() as session:
        summaries = analyze(session, window=args.window)

    if args.json:
        print(json.dumps([item.as_dict() for item in summaries], indent=2, default=str))
        return 0

    if not summaries:
        print("no data available — run `agrodata collect` first")
        return 0

    print(f"{'SYMBOL':<8} {'PRICE':>10} {'AVG':>10} {'TREND':>7} {'SAMPLES':>8}")
    for item in summaries:
        average = f"{item.moving_average:.2f}" if item.moving_average is not None else "n/a"
        print(
            f"{item.symbol:<8} {item.latest_price:>10.2f} {average:>10} "
            f"{item.direction.upper():>7} {item.samples:>8}"
        )
    return 0


def _check(settings: Settings, *, as_json: bool) -> int:
    engine = build_engine(settings)
    reachable = is_database_reachable(
        engine,
        attempts=settings.db_connect_attempts,
        backoff_seconds=settings.db_retry_backoff_seconds,
    )
    rows = None
    if reachable:
        with build_session_factory(engine)() as session:
            rows = session.execute(select(func.count()).select_from(CommodityPrice)).scalar_one()

    payload = {
        "version": __version__,
        "dataSource": settings.data_source,
        "symbols": list(settings.symbols),
        "database": settings.masked_database_url,
        "reachable": reachable,
        "rows": rows,
    }
    text = "\n".join(
        [
            f"version   : {__version__}",
            f"source    : {settings.data_source}",
            f"symbols   : {', '.join(settings.symbols)}",
            f"database  : {settings.masked_database_url}",
            f"reachable : {'yes' if reachable else 'no'}",
            f"rows      : {rows if rows is not None else 'n/a'}",
        ]
    )
    _emit(payload, as_json=as_json, text=text)
    return 0 if reachable else 1


def _verify_source(args: argparse.Namespace) -> int:
    """Parse a saved page so a layout change can be checked without the network."""
    from agrodata.collectors.cepea import parse_file

    sample = parse_file(args.html, args.symbol)
    if sample is None:
        _emit(
            {"symbol": args.symbol.upper(), "parsed": False},
            as_json=args.json,
            text=f"could not parse {args.html} — the table layout probably changed",
        )
        return 1

    payload = {
        "symbol": sample.symbol,
        "price": sample.price,
        "timestamp": sample.timestamp.isoformat(),
        "source": sample.source,
        "parsed": True,
    }
    _emit(
        payload,
        as_json=args.json,
        text="\n".join(
            [
                f"symbol    : {sample.symbol}",
                f"price     : {sample.price:.2f}",
                f"timestamp : {sample.timestamp.isoformat()}",
                f"source    : {sample.source}",
            ]
        ),
    )
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.json = bool(getattr(args, "json", False))

    if args.command == "version":
        print(__version__)
        return 0

    # `verify-source` only parses a file: it needs neither the database nor the
    # collector configuration, so it must work before Settings is validated.
    if args.command == "verify-source":
        configure_logging(args.log_level or "INFO", json_logs=False)
        return _verify_source(args)

    settings = _load_settings({"log_level": args.log_level})
    if settings is None:
        return 2
    configure_logging(settings.log_level, json_logs=settings.log_json)

    if args.command == "init-db":
        init_schema(build_engine(settings))
        print("schema is up to date")
        return 0

    if args.command == "check":
        return _check(settings, as_json=args.json)

    engine = build_engine(settings)
    session_factory = build_session_factory(engine)

    if args.command == "collect":
        return _collect(args, settings, session_factory)
    if args.command == "analyze":
        return _analyze(args, session_factory)

    parser.error(f"unknown command: {args.command}")
    return 2


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
