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
| Reliability | per-symbol error isolation + retries with backoff (provider **and** database) | one flaky call never discards the whole snapshot, and a dropped connection is not an hour of lost data |
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
agrodata verify-source --html pagina.html --symbol SOJA   # parse a saved CEPEA page
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
| `DATA_SOURCE` | `simulated` | `simulated`, `http` or `cepea` |
| `COMMODITY_API_URL` | – | required when `DATA_SOURCE=http` |
| `CEPEA_URL_TEMPLATE` | – | optional override, e.g. `https://.../indicador/{symbol}.aspx`; required for symbols without a known URL |
| `DB_CONNECT_ATTEMPTS` | `3` | attempts when the database connection or commit is transiently refused |
| `DB_RETRY_BACKOFF_SECONDS` | `0.5` | exponential backoff base for the database retry |
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
│   ├── http.py      # retrying provider client
│   └── cepea.py     # ESALQ/CEPEA HTML parser, verifiable offline
├── pipeline.py      # collect → validate → persist, returns PipelineReport
├── analytics.py     # moving averages / trend classification
└── cli.py           # collect | analyze | init-db | check | verify-source | version
```

## Quality gates

```bash
pytest                 # 75 tests, coverage gate at 80% (currently 94%)
ruff check . && ruff format --check .
mypy agrodata          # strict mode
```

CI runs all three on every push and pull request (`.github/workflows/data-engine.yml`).

## The CEPEA collector

CEPEA/ESALQ publishes the reference indicator for Brazilian grains as a public HTML
table, without an API. `DATA_SOURCE=cepea` parses that table:

```bash
DATA_SOURCE=cepea agrodata collect --symbols SOJA,MILHO --dry-run
```

Two rules keep this honest:

- **a missing value is never guessed** — if the table or the price cannot be found, the
  collector returns `None`, logs the reason and the pipeline reports the symbol as an error;
- **the parser is verifiable without the network** — `agrodata verify-source --html <file>
  --symbol <TICKER>` runs the exact same code against a saved page, so a layout change can be
  diagnosed (and fixed) offline. `tests/fixtures/cepea_soja.html` is a synthetic page with the
  same structure and is what the test suite asserts against.

When the site changes, the workflow is: save the new page, run `verify-source`, adjust the
parser (date in the first column, value in the second), and keep the saved page as the new
fixture.
