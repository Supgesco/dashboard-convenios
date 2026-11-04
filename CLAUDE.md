# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Dashboard of "convênios" built from SIAFE (Fazenda RJ) data and spreadsheets. The back-end has two on-demand ETLs into Postgres: the SIAFE FlexVision query and the convênios spreadsheet ("Planilha Geral Somando Forças"). No front-end code exists yet.

## Layout

- `api/` — Python 3.12 back-end managed with **uv**. FastAPI, SQLAlchemy 2 + Alembic (Postgres via psycopg2), httpx, openpyxl (spreadsheet ETL), pandas. Config comes from `api/.env` (see `api/README.md` for the variables).
  - `app/config.py` — `Settings` (pydantic-settings); secrets are `SecretStr`.
  - `app/db.py` — engine (`hide_parameters=True`) and `Base`; `app/models.py` — tables.
  - `app/siafe/client.py` — SIAFE auth + FlexVision query, retry/backoff and one re-auth on 401. The query format (`?params=<UG>,<MES>,<ANO>`) lives only in `rota_consulta`.
  - `app/siafe/transform.py` — response → typed rows. The field→column map is `CAMPOS`; the trailing `"Total"` row is dropped.
  - `app/etl/siafe.py` — load service + CLI. Fetches every month from 2023-01 to the current month (America/Sao_Paulo) into memory, then `DELETE` + insert in one transaction (atomic overwrite). A Postgres advisory lock allows one load at a time across CLI and HTTP. `etl_execucao` is written in separate transactions so failures survive the rollback.
  - `app/planilha/` — spreadsheet ETL, extract and transform kept apart:
    - `layout.py` — the single source of the sheet → table mapping: sheets, header rows, end-of-data rules, and each column's letter, name, *papel* (normalization role) and expected header. Models and the migration derive from it; a spreadsheet revision with a new structure means editing it plus a new migration.
    - `extracao.py` — opens the xlsx, validates sheet names, headers, end markers and stray cells (any mismatch → `ErroLayout`, nothing written) and returns raw rows with merge info. `Planilha2` is a known sheet that is ignored.
    - `transformacao.py` — pure functions (no DB): per-papel cleaning/typing plus sheet rules (continuation rows inherit identification but not values, merged município, the H–K column shift on 342/ACOMPANHAMENTO, repeated columns of sheet 31). Content it can't use becomes NULL plus an *aviso* (sheet, cell, motivo, original value), never a failure.
    - `dominios.py` — the 92 RJ municipalities, abbreviation aliases and category vocabularies; matching uses `chave()` (no accents/case/spaces/punctuation), no fuzzy matching. New spellings show up as avisos and are fixed here.
  - `app/etl/planilha.py` — spreadsheet load service + CLI, same pattern as the SIAFE load (own advisory lock, `planilha_importacao` record with file SHA-256 and avisos, `DELETE` + insert into the 8 `planilha_*` tables in one transaction).
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
uv run python -m app.etl.planilha ../data/<planilha>.xlsx  # run the spreadsheet ETL (0 ok, 1 failure, 2 already running)
uv run pytest                        # tests; integration tests need TEST_DATABASE_URL
uv run pytest tests/test_siafe_transform.py::test_lista_vazia_e_mes_sem_registros  # single test
```

`TEST_DATABASE_URL` points the integration tests at a Postgres; they truncate the tables. The suite aborts if `siafe_flexvision`, `planilha_importacao` or any `planilha_*` table already has data, so it cannot wipe a loaded database. Spreadsheet tests build synthetic workbooks with `tests/planilha_sintetica.py`.

## SIAFE API notes

- Avoid repeated `POST /auth` calls: a burst of logins got this machine's IP temporarily blocked (401 with an empty body). The client logs in once per load and reuses the token.
- `/auth` sometimes returns 200 with an empty body; the client treats that as transient.

## Conventions

- Commit messages follow Conventional Commits with descriptions in Portuguese (e.g. `chore: adição do .gitignore ...`).
