# API — Dashboard Convênios

Back-end em FastAPI. A primeira funcionalidade é a carga sob demanda da consulta FlexVision do SIAFE para o Postgres.

## Configuração

Crie `api/.env` (já ignorado pelo git) com:

| Variável | Descrição |
|---|---|
| `SIAFE_URL` | URL base da API do SIAFE |
| `SIAFE_USER` | usuário do SIAFE |
| `SIAFE_PASSWORD` | senha do SIAFE |
| `SIAFE_UG` | Unidade Gestora consultada |
| `SIAFE_CONSULTA` | ID da consulta FlexVision |
| `DATABASE_URL` | URL SQLAlchemy do Postgres (`postgresql+psycopg2://...`) |
| `TEST_DATABASE_URL` | *(opcional, testes)* Postgres usado pelos testes de integração. Pode ser variável de ambiente. |

## Uso

```bash
uv sync
uv run alembic upgrade head          # cria as tabelas
uv run python -m app.etl.siafe       # carga completa (2023-01 até o mês atual), sobrescreve a anterior
uv run fastapi dev app/main.py       # servidor de desenvolvimento
```

Endpoints:

- `POST /etl/siafe`: inicia a carga em segundo plano. Responde `202 {"execucao_id", "status"}`, ou `409` se já houver carga em andamento.
- `GET /etl/siafe/status`: retorna a execução mais recente (`status`: `em_andamento` | `sucesso` | `falha`), ou `404` se nenhuma carga foi feita.

Cada carga substitui todos os registros de `siafe_flexvision` numa única transação. Se a carga falhar, os dados anteriores continuam intactos e a falha fica registrada em `etl_execucao`.

## Testes

```bash
uv run pytest                        # sem TEST_DATABASE_URL, os testes de integração são pulados
```

Os testes de integração truncam `siafe_flexvision` e `etl_execucao`. A suíte aborta se `siafe_flexvision` já tiver dados.
