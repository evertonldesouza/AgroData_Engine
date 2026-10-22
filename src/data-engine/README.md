# Data Engine

Python service that keeps the AgroData warehouse fed and computes the trend
indicators exposed by the API.

```text
   ┌──────────────┐   collect    ┌──────────────┐   persist   ┌──────────────┐
   │   collector  │ ───────────▶ │   pipeline   │ ──────────▶ │  PostgreSQL  │
   │ simulated/http│              │ validate/dedupe│             │  Commodities │
   └──────────────┘              └──────────────┘              └──────┬───────┘
                                                                     │
   ┌──────────────┐   pandas     ┌──────────────┐                     │
   │   analytics  │ ◀─────────── │    CLI       │ ◀───────────────────┘
   │  MA + trend  │              │ collect/analyze/check
   └──────────────┘              └──────────────┘
```

## Why it looks like this

| Concern | Decision | Reason |
| --- | --- | --- |
| Configuration | `pydantic-settings` with a `Settings` class | invalid env fails at start-up with a readable message instead of a `KeyError` mid-run |
| Sources | `PriceCollector` protocol + factory | swapping the simulator for a paid feed is a one-line env change, no pipeline edits |
| Reliability | per-symbol error isolation + retries with backoff | one flaky provider call never discards the whole snapshot |
| Idempotency | optional dedupe window | re-running the cron within the same hour does not create duplicated quotes |
| Observability | structured `PipelineReport` + JSON logs | GitHub Actions runs are grep/jq-friendly and the report is the future `/metrics` source |
| Testing | SQLite in-memory + fake HTTP session | the full pipeline runs in <1s with no external services |

## Quick start

```bash
cd src/data-engine
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

export DATABASE_URL="postgresql://admin:mysecretpassword@localhost:5432/agrodata"

agrodata init-db                 # create tables that don't exist yet
agrodata collect                 # collect + persist one snapshot
agrodata collect --dry-run --json
agrodata analyze --window 7
agrodata check                   # config + connectivity + row count
```

`python -m agrodata ...` works as well; the `agrodata` console script is just a
thin shim.

### Sample output

```console
$ agrodata collect
2026-10-22 14:02:11 INFO     agrodata.pipeline | Pipeline started
2026-10-22 14:02:11 INFO     agrodata.pipeline | Pipeline finished
collector : simulated
inserted  : 2
skipped   : 0
errors    : 0
duration  : 12 ms

$ agrodata analyze
SYMBOL        PRICE        AVG   TREND  SAMPLES
MILHO         58.12      57.98      UP       48
SOJA         136.41     135.77      UP       48
```

## Configuration

All variables can come from the environment or a `.env` file.

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | *required* | SQLAlchemy URL of the PostgreSQL warehouse |
| `DATA_SOURCE` | `simulated` | `simulated` or `http` |
| `COMMODITY_API_URL` | – | required when `DATA_SOURCE=http` |
| `SYMBOLS` | `SOJA,MILHO` | comma separated symbols to ingest |
| `SOURCE_LABEL` | `Simulated Market Data` | value stored in the `Source` column |
| `HTTP_TIMEOUT_SECONDS` | `8` | per-request timeout |
| `MAX_RETRIES` | `3` | attempts for transient provider failures |
| `RETRY_BACKOFF_SECONDS` | `0.5` | exponential backoff base |
| `DEDUPE_WINDOW`¹ | `0` | skip identical quotes inside this window |
| `LOG_LEVEL` | `INFO` | `DEBUG`/`INFO`/`WARNING`/`ERROR` |
| `LOG_JSON` | `false` | one JSON object per log line |
| `RANDOM_SEED` | `42` | keeps the simulator reproducible |

¹ exposed as `--dedupe-window` on the CLI.

## Layout

```text
agrodata/
├── config.py        # typed settings + secret masking
├── db.py            # engine/session lifecycle
├── models.py        # SQLAlchemy mapping (matches the EF Core migration)
├── schemas.py       # PriceSample value object with validation
├── collectors/
│   ├── simulated.py # seeded mean-reverting walk
│   └── http.py      # retrying provider client
├── pipeline.py      # collect → validate → persist, returns PipelineReport
├── analytics.py     # moving averages / trend classification
└── cli.py           # collect | analyze | init-db | check | version
```

## Quality gates

```bash
pytest                 # 41 tests, coverage gate at 80% (currently 93%)
ruff check . && ruff format --check .
mypy agrodata          # strict mode
```

CI runs all three on every push and pull request (`.github/workflows/data-engine.yml`).
