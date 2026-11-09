# Tasks

## 1. Setup do back-end

- [x] 1.1 Adicionar dependências com `uv add psycopg2-binary pydantic-settings` e `uv add --dev pytest respx`; verificar que `uv sync` conclui e `uv run python -c "import psycopg2, pydantic_settings, respx"` não falha
- [x] 1.2 Criar o pacote `api/app/` (`__init__.py`, `config.py`, `db.py`, `main.py`), remover o placeholder `api/main.py` e verificar que `uv run fastapi dev app/main.py` sobe e responde em `/docs`
- [x] 1.3 Implementar `app/config.py` com `Settings` (pydantic-settings, lendo `api/.env`; `SIAFE_PASSWORD` e `DATABASE_URL` como `SecretStr`) e um teste verificando que `repr(settings)` não contém os valores secretos
- [x] 1.4 Implementar `app/db.py` (engine SQLAlchemy 2 com `hide_parameters=True`, sessionmaker) e verificar a conexão com `uv run python -c "from app.db import engine; engine.connect().close()"`
- [x] 1.5 Inicializar o Alembic em `api/` (`alembic init alembic`), configurar `env.py` para usar `Settings.DATABASE_URL` e o metadata de `app.models`, e verificar que `uv run alembic current` executa sem erro
- [x] 1.6 Configurar o pytest (`[tool.pytest.ini_options]` no `pyproject.toml`, `tests/conftest.py` com fixture de Postgres via `TEST_DATABASE_URL`, pulada se ausente) e verificar que `uv run pytest` roda

## 2. Cliente SIAFE

- [x] 2.1 Implementar `app/siafe/client.py`: `autenticar()` (POST `/auth` com `{usuario, senha}`) e `consultar(ano, mes)` (GET `/flexvision-consulta/{SIAFE_CONSULTA}` com bearer token, timeout de 60s); verificar com teste `respx` que o token obtido vai no cabeçalho `Authorization`
- [x] 2.2 Adicionar retry com backoff (até 3 tentativas para timeout/conexão/5xx/429) e reautenticação única em 401; verificar com testes `respx` os cenários "503 depois 200", "3 falhas → erro", "401 → reauth → 200" e "401 persistente → erro"
- [x] 2.3 Garantir que exceções e logs do cliente não contêm usuário, senha nem token; verificar com teste que força falha de auth e inspeciona a mensagem e o `caplog`

## 3. Modelo de dados e transformação

- [x] 3.1 Coletar uma amostra real da consulta FlexVision (um mês) com um script ad hoc fora do repositório ou salvando em `data/` (git-ignored). A partir dela, confirmar nomes dos parâmetros, formato do mês, paginação e a lista de campos/tipos. Registrar o mapeamento no design.md, sem valores reais. Verificar que `git status` não mostra a amostra
- [x] 3.2 Implementar `app/models.py` com `EtlExecucao` (id, origem, inicio, fim, status, registros, erro) e `SiafeFlexvision` (id, execucao_id, ano, mes, ug + colunas tipadas da 3.1; `NUMERIC(18,2)` para valores, índice em `(ano, mes)`)
- [x] 3.3 Gerar a migration Alembic das duas tabelas e verificar `uv run alembic upgrade head` seguido de `uv run alembic downgrade base` e `upgrade head` de novo, sem erro, num banco de teste
- [x] 3.4 Implementar `app/siafe/transform.py` (mapeamento campo→coluna→tipo centralizado, conversão de datas e decimais, erro com mês e campo quando faltar coluna ou a conversão falhar); verificar com testes usando fixtures **sintéticos** no formato da amostra, incluindo lista vazia e valor monetário com casas decimais

## 4. Serviço de carga e CLI

- [x] 4.1 Implementar a geração do período (2023-01 até o mês corrente em America/Sao_Paulo); verificar com teste que, para 2026-11-03, gera 47 pares, de (2023, 1) a (2026, 11)
- [x] 4.2 Implementar `app/etl/siafe.py`: advisory lock, marcação de execuções `em_andamento` órfãs como `falha`, criação/atualização de `etl_execucao` em transações próprias, extração completa em memória e depois `DELETE` + bulk insert numa única transação. Verificar com testes de integração (Postgres de teste + `respx`) que o sucesso substitui todos os registros e que a falha no meio mantém os registros anteriores e grava `falha` com erro
- [x] 4.3 Verificar com teste de integração que uma segunda carga com o lock ocupado é recusada sem chamar o SIAFE
- [x] 4.4 Adicionar o entry point da CLI (`uv run python -m app.etl.siafe`) com códigos de saída 0/≠0 e resumo da quantidade de registros; verificar com teste que chama `main()` com SIAFE mockado nos casos de sucesso e falha

## 5. Endpoints HTTP

- [x] 5.1 Implementar `app/routers/etl.py` com `POST /etl/siafe` (lock + criação da execução síncronos, carga via `BackgroundTasks`, 202 com id, ou 409 com o id em andamento) e registrar o router em `app/main.py`; verificar com `TestClient` os casos 202 e 409
- [x] 5.2 Implementar `GET /etl/siafe/status` (execução mais recente, ou 404 se não houver); verificar com `TestClient` os casos 200 e 404 e que a resposta não contém credenciais

## 6. Documentação e verificação integrada

- [x] 6.1 Atualizar o `CLAUDE.md` (estrutura `api/app/`, comandos de migration, carga, testes e `TEST_DATABASE_URL`) e o `api/README.md` (variáveis do `.env` necessárias, sem valores); verificar que os comandos documentados executam como escritos
- [x] 6.2 Executar uma carga real em ambiente de homologação via CLI e outra via `POST /etl/siafe`; verificar em `GET /etl/siafe/status` o status `sucesso`, conferir que a contagem em `siafe_flexvision` bate com o total informado e que existem registros de 2023-01 até o mês corrente
