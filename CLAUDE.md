# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Dashboard of "convênios" built from SIAFE (Fazenda RJ) data and spreadsheets. The back-end has its first feature: an on-demand ETL that loads the SIAFE FlexVision query into Postgres. No front-end code exists yet.

## Layout

- `api/` — Python 3.12 back-end managed with **uv**. FastAPI, SQLAlchemy 2 + Alembic (Postgres via psycopg2), httpx, pandas/openpyxl (for future spreadsheet imports). Config comes from `api/.env` (see `api/README.md` for the variables).
  - `app/config.py` — `Settings` (pydantic-settings); secrets are `SecretStr`.
  - `app/db.py` — engine (`hide_parameters=True`) and `Base`; `app/models.py` — tables.
  - `app/siafe/client.py` — SIAFE auth + FlexVision query, retry/backoff and one re-auth on 401. The query format (`?params=<UG>,<MES>,<ANO>`) lives only in `rota_consulta`.
  - `app/siafe/transform.py` — response → typed rows. The field→column map is `CAMPOS`; the trailing `"Total"` row is dropped.
  - `app/etl/siafe.py` — load service + CLI. Fetches every month from 2023-01 to the current month (America/Sao_Paulo) into memory, then `DELETE` + insert in one transaction (atomic overwrite). A Postgres advisory lock allows one load at a time across CLI and HTTP. `etl_execucao` is written in separate transactions so failures survive the rollback.
  - `app/routers/etl.py` — `POST /etl/siafe` (202, runs in `BackgroundTasks`; 409 if a load is running) and `GET /etl/siafe/status`.
  - `alembic/` — migrations; `env.py` reads the URL from settings (or `ALEMBIC_DATABASE_URL`), never from `alembic.ini`.
- `data/` — local database and spreadsheet files. Everything in it except `.gitkeep` is git-ignored, as are `*.db`, `*.sqlite*`, `*.xlsx`, `*.xls`, `*.csv` anywhere. This data is real convênio data: never commit it or add it as fixtures — tests use synthetic fixtures shaped like the real response.
- `web/` — planned React front-end (referenced in `.gitignore`, not created yet).
- `openspec/` — OpenSpec planning (schema `spec-driven`). Changes go in `openspec/changes/`, accepted specs in `openspec/specs/`. Use the `/opsx:*` commands (propose → apply → archive) for new features.

## Commands

Run from `api/`:

```bash
uv sync                              # install dependencies into api/.venv
uv add <pkg>                         # add a dependency
uv run alembic upgrade head          # apply migrations
uv run fastapi dev app/main.py       # dev server (docs at /docs)
uv run python -m app.etl.siafe       # run the SIAFE load (exit 0 = success)
uv run pytest                        # tests; integration tests need TEST_DATABASE_URL
uv run pytest tests/test_siafe_transform.py::test_lista_vazia_e_mes_sem_registros  # single test
```

`TEST_DATABASE_URL` points the integration tests at a Postgres; they truncate the tables. The suite aborts if `siafe_flexvision` already has data, so it cannot wipe a loaded database.

## SIAFE API notes

- Avoid repeated `POST /auth` calls: a burst of logins got this machine's IP temporarily blocked (401 with an empty body). The client logs in once per load and reuses the token.
- `/auth` sometimes returns 200 with an empty body; the client treats that as transient.

## Conventions

- Commit messages follow Conventional Commits with descriptions in Portuguese (e.g. `chore: adição do .gitignore ...`).
