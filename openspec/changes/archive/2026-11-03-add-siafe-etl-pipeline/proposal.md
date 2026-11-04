# Proposal

## Why

O dashboard de convênios precisa de dados financeiros oficiais do SIAFE (Fazenda RJ), que hoje não estão no banco do projeto. A consulta FlexVision do SIAFE já entrega esses dados por UG, ano e mês. Falta uma pipeline que extraia, transforme e persista esse histórico no Postgres para o back-end consumir.

## What Changes

- Nova pipeline ETL que:
  - autentica no SIAFE (`POST {SIAFE_URL}/auth` com `{usuario, senha}`) e obtém um bearer token;
  - consulta `GET {SIAFE_URL}/flexvision-consulta/{SIAFE_CONSULTA}` para a UG configurada (`SIAFE_UG`), mês a mês, de janeiro de 2023 até o mês corrente;
  - normaliza a resposta em registros tipados e os grava no Postgres (`DATABASE_URL`).
- A carga é **sob demanda** e faz **overwrite**: cada execução substitui integralmente os dados SIAFE anteriores, de forma atômica. Se a execução falhar, os dados anteriores continuam intactos.
- Dois gatilhos que usam o mesmo serviço:
  - comando de linha (`uv run ...`) para execução manual ou por agendador externo;
  - endpoint HTTP no FastAPI para disparar a carga e consultar o status da última execução.
- Registro de cada execução (início, fim, status, quantidade de registros, erro) para auditoria e para o endpoint de status.
- Primeira estrutura real do back-end em `api/app/`: configuração via `.env`, conexão com o banco, migrations Alembic e app FastAPI.
- Novas dependências: driver Postgres (`psycopg2`, conforme o esquema `postgresql+psycopg2` do `DATABASE_URL`), `pydantic-settings` e ferramentas de teste (`pytest`, `respx`).

## Capabilities

### New Capabilities
- `siafe-ingestion`: extração dos dados da consulta FlexVision do SIAFE (autenticação, período coberto, parâmetros), persistência com overwrite atômico, gatilhos sob demanda e registro de execuções.

### Modified Capabilities
<!-- Nenhuma: não há specs existentes em openspec/specs/. -->

## Impact

- **Código**: novo pacote `api/app/` (config, db, models, cliente SIAFE, serviço ETL, CLI, rotas FastAPI) e diretório Alembic em `api/`.
- **Banco**: novas tabelas no Postgres, uma para os dados da consulta (colunas tipadas definidas a partir de uma resposta real) e outra para o log de execuções, criadas via migration Alembic.
- **API**: novos endpoints `POST /etl/siafe` e `GET /etl/siafe/status`.
- **Sistemas externos**: a API do SIAFE recebe cerca de 12 requisições por ano de histórico a cada carga, partindo de 2023.
- **Segurança**: as credenciais do SIAFE e o token nunca aparecem em log nem são versionados. Os endpoints de carga não têm autenticação nesta change (ver design.md).
