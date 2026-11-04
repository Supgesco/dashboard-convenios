# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Dashboard of "convênios" built from SIAFE (Fazenda RJ) data and spreadsheets. The back-end has two on-demand ETLs into Postgres: the SIAFE FlexVision query and the convênios spreadsheet ("Planilha Geral Somando Forças"). The front-end (`web/`) is a read-only React app over that API, plus the SIAFE load trigger.

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
  - `app/routers/etl.py` — `POST /etl/siafe` (202, runs in `BackgroundTasks`; 409 if a load is running), `GET /etl/siafe/status` and `GET /etl/siafe/execucoes` (history, newest first, paginated with `pagina`/`tamanho` like the dashboard lists). The API has no authentication: it must stay on the internal network.
  - `app/routers/painel.py` — read-only management dashboard: `GET /painel/resumo`, `/serie`, `/municipios`, `/convenios`, all with `recorte` (`31` ⊂ `89` ⊂ `342`) and a repeatable `municipio` filter (normalized via `dominios.chave()`, unknown → 422). `/municipios` and `/convenios` are paginated (`pagina`, `tamanho` 1–100, default 20) and ordered server-side (`ordem=[-]campo`, from a per-endpoint whitelist in `consultas.ORDEM_RANKING`/`ORDEM_LISTA`; the column name never comes from the request text), returning `total`; `/serie` is not paginated. `GET /painel/convenio?numero=&municipio=` is the detail of one convênio (key normalized with the spreadsheet ETL's `numero_convenio` and the município filter's normalizer; 422 invalid, 404 unknown; no `recorte`): identification, month and previous-month balances, contract values as one block per sheet (31/89) and the monthly series. The router only validates and shapes JSON. `get_hoje` (overridable) defines the default month.
  - `app/painel/consultas.py` — the dashboard SQL (literal, parameterized). SIAFE balances always sum the *distinct* codes of the selected convênios, never `v_convenio_saldo` across convênios (a shared code would count twice). Percentages are ratios of sums. Missing data stays NULL.
  - `alembic/` — migrations; `env.py` reads the URL from settings (or `ALEMBIC_DATABASE_URL`), never from `alembic.ini`.
    - `0003` creates the SIAFE × planilha cross-reference as plain Postgres views (`v_convenio`, `v_convenio_codigo`, `v_convenio_registro`, `v_convenio_saldo_codigo`, `v_convenio_saldo`, `v_cruzamento_falha`, plus the intermediate `v_cruzamento_linha` and `v_cruzamento_codigo_origem`), computed on read, so neither load knows about them. The SQL is literal (doesn't import the layout). The views are outside `Base.metadata`, so `alembic check` ignores them. A future migration that alters a `planilha_*` table or `siafe_flexvision` must drop and recreate the dependent views (Postgres refuses the `ALTER`/`DROP` otherwise). Tests: `tests/test_cruzamento.py`.
    - `0004` adds the dashboard views on top of `0003`: `v_recorte_convenio` (convênios per recorte, with status and situação da vigência) and `v_valor_contratual` (contract values per convênio for recortes 31 and 89, each from its own sheet, summing continuation rows; realinhado vs. inicial chosen once per convênio). Same rules as `0003`: literal SQL, outside `Base.metadata`, and they also must be dropped/recreated when a `planilha_*` table they read changes. Tests: `tests/test_painel_views.py`, `test_painel_consultas.py`, `test_routers_painel.py`.
- `data/` — local database and spreadsheet files. Everything in it except `.gitkeep` is git-ignored, as are `*.db`, `*.sqlite*`, `*.xlsx`, `*.xls`, `*.csv` anywhere. This data is real convênio data: never commit it or add it as fixtures — tests use synthetic fixtures shaped like the real response.
- `web/` — React 19 + TypeScript + Tailwind CSS v4 front-end (Vite, npm; see `web/README.md`). React Router, TanStack Query, Recharts; tests with Vitest + Testing Library.
  - Screens: `/` (visão geral), `/municipios`, `/convenios`, `/convenio?numero=&municipio=` (detail), `/cargas` (last load, history, trigger with confirmation). Navigation is a sidebar (a drawer on narrow screens). Recortes are shown by name, never by sheet number: 342 "Histórico inicial", 89 "Primeiro realinhamento", 31 "Vigentes" (`src/recortes.ts`). Each name carries its convênio count from `/painel/resumo` (no município, no month); the counts are never hardcoded. Filters (`recorte`, repeated `municipio`, `ano`/`mes`, `pagina`, `ordem`) live only in the URL (`src/filtros.ts`); without `ano`/`mes` the screens use `ultimo_mes_disponivel` from `/painel/resumo`.
  - `src/api/cliente.ts` (fetch + `ApiErro`), `src/api/hooks.ts` (one query hook per endpoint; nothing persisted in the browser), `src/formato.ts` (all pt-BR formatting; only `null` becomes "—").
  - `src/api/openapi.json` and `schema.d.ts` are generated from the API's OpenAPI by `npm run api:tipos` (no DB needed) and committed: regenerate them whenever an API response model changes.
  - Dev server proxies `/api` → `API_URL` (default `http://localhost:8010`; the dev server is pinned to 5180 with `strictPort`, since 8000/5173 are often taken by other projects on this machine), so the API has no CORS. Tests stub `fetch` per route with synthetic fixtures (`src/teste/`); they never call the real API.
- `openspec/` — OpenSpec planning (schema `spec-driven`). Changes go in `openspec/changes/`, accepted specs in `openspec/specs/`. Use the `/opsx:*` commands (propose → apply → archive) for new features.

## Commands

Run from `api/`:

```bash
uv sync                              # install dependencies into api/.venv
uv add <pkg>                         # add a dependency
uv run alembic upgrade head          # apply migrations
uv run fastapi dev app/main.py --port 8010  # dev server (docs at /docs); 8010 is what web/ proxies to
uv run python -m app.etl.siafe       # run the SIAFE load (exit 0 = success)
uv run python -m app.etl.planilha ../data/<planilha>.xlsx  # run the spreadsheet ETL (0 ok, 1 failure, 2 already running)
uv run pytest                        # tests; integration tests need TEST_DATABASE_URL
uv run pytest tests/test_siafe_transform.py::test_lista_vazia_e_mes_sem_registros  # single test
```

`TEST_DATABASE_URL` points the integration tests at a Postgres; they truncate the tables. The suite aborts if `siafe_flexvision`, `planilha_importacao` or any `planilha_*` table already has data, so it cannot wipe a loaded database. Spreadsheet tests build synthetic workbooks with `tests/planilha_sintetica.py`.

Run from `web/`:

```bash
npm install
npm run dev                          # http://localhost:5180 (API at localhost:8010, or API_URL=...)
npm test                             # Vitest
npx tsc -b && npm run build          # typecheck + production build
npm run api:tipos                    # regenerate API types after changing a response model
```

## SIAFE API notes

- Avoid repeated `POST /auth` calls: a burst of logins got this machine's IP temporarily blocked (401 with an empty body). The client logs in once per load and reuses the token.
- `/auth` sometimes returns 200 with an empty body; the client treats that as transient.

## Conventions

- Commit messages follow Conventional Commits with descriptions in Portuguese (e.g. `chore: adição do .gitignore ...`).
