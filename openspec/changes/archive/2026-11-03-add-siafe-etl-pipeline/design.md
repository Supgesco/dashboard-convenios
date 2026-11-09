# Design

## Context

- O back-end ainda é só o scaffold do `uv init` (`api/main.py` placeholder, `api/app/` vazio). Esta change cria a primeira estrutura real.
- `api/.env` já define `SIAFE_USER`, `SIAFE_PASSWORD`, `SIAFE_UG`, `SIAFE_URL`, `SIAFE_CONSULTA` e `DATABASE_URL`. O `DATABASE_URL` usa o esquema `postgresql+psycopg2`, mas `psycopg2` ainda não está nas dependências.
- O formato da resposta da FlexVision **não é conhecido** no planejamento. As colunas da tabela tipada saem de uma amostra real coletada na implementação (tarefa 3.1).
- Requisitos: ver `specs/siafe-ingestion/spec.md`. Motivação: ver `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Um único serviço de carga, chamado tanto pela CLI quanto pelo endpoint HTTP.
- Overwrite atômico: nada de estado "meio carregado" visível no banco.
- Cliente SIAFE isolado e testável sem rede (mock HTTP).

**Non-Goals:**
- Agendamento automático: a carga é sob demanda; um cron externo pode chamar a CLI.
- Carga incremental ou apenas do mês corrente: toda execução é completa, de 2023 até hoje.
- Autenticação/autorização dos endpoints `/etl/*`, que fica para quando o app tiver autenticação.
- Múltiplas UGs ou consultas por execução: só a UG e a consulta configuradas no `.env`.
- Front-end.

## Decisions

### Estrutura do pacote
```
api/
  app/
    config.py          # Settings (pydantic-settings) lidas de api/.env
    db.py              # engine/sessionmaker SQLAlchemy 2
    models.py          # SiafeFlexvision, EtlExecucao
    siafe/client.py    # auth + consulta FlexVision (httpx)
    siafe/transform.py # resposta JSON -> registros tipados
    etl/siafe.py       # serviço de carga + entry point da CLI (__main__)
    routers/etl.py     # POST /etl/siafe, GET /etl/siafe/status
    main.py            # FastAPI app
  alembic/ , alembic.ini
  tests/
```
`api/main.py` (placeholder) é removido; o app passa a rodar com `uv run fastapi dev app/main.py`.

### Extrair tudo, depois gravar numa transação
O serviço primeiro consulta os 47+ meses e transforma tudo em memória. Só então abre uma transação e executa `DELETE FROM siafe_flexvision` seguido de um bulk insert. O volume esperado (alguns milhares de linhas por mês para uma UG) cabe em memória.
- *Por que DELETE e não TRUNCATE:* no Postgres, `TRUNCATE` pega um lock `ACCESS EXCLUSIVE` que bloqueia leitores durante toda a carga. Com `DELETE` dentro da transação, os leitores continuam vendo o conjunto antigo (MVCC) até o commit, como a spec exige.
- *Alternativa descartada:* carregar numa tabela de staging e trocar por `ALTER TABLE ... RENAME`. Também é atômica, mas complica migrations e índices sem ganho real nesse volume.
- *Alternativa descartada:* gravar mês a mês durante a extração. Deixaria o banco parcialmente carregado se o SIAFE falhasse no meio.

### Tabela tipada definida a partir de amostra real
`siafe_flexvision` terá colunas fixas (`id`, `execucao_id` com FK para `etl_execucao`, `ano`, `mes`, `ug`) mais uma coluna tipada por campo da consulta FlexVision. Os tipos seguem a regra: datas → `DATE`, valores → `NUMERIC(18,2)`, códigos/identificadores → `TEXT`, nunca `float`. Os nomes das colunas são os campos da resposta convertidos para snake_case. O mapeamento campo→coluna→tipo fica num único dicionário em `transform.py`, o que facilita ajustar se a consulta FlexVision mudar.
- Índice em `(ano, mes)` para os filtros do dashboard.
- Se a consulta ganhar ou perder campos no SIAFE, a carga falha com mensagem clara (spec "Resposta fora do formato esperado"), e o ajuste é uma migration nova.

### Mapeamento da resposta (confirmado com amostra real, tarefa 3.1)
A consulta devolve uma lista JSON de objetos com sempre as mesmas 8 chaves, todas strings. A **última linha é um total** (`"Total"` em todos os campos de texto), igual à soma das demais, e é descartada.

| Campo FlexVision | Coluna(s) | Tipo | Observação |
|---|---|---|---|
| `Unidade Gestora` (`"<código> - <nome>"`) | `ug_nome` | `TEXT` | o código já está em `ug` (valor consultado) |
| `Conta Corrente` | `conta_corrente` | `TEXT` | código numérico; texto para preservar zeros à esquerda |
| `Conta contábil` (`"<código> - <nome>"`) | `conta_contabil`, `conta_contabil_nome` | `TEXT`, `TEXT` | nome sem espaços nas pontas |
| `Credor` (`"<código> - <nome>"`) | `credor`, `credor_nome` | `TEXT NULL` | veio vazio (`" - "`) na amostra → `NULL` |
| `Convenios a pagar` | `convenios_a_pagar` | `NUMERIC(18,2)` | decimal com ponto |
| `Convênios a comprovar` | `convenios_a_comprovar` | `NUMERIC(18,2)` | |
| `Convênios a aprovar` | `convenios_a_aprovar` | `NUMERIC(18,2)` | |
| `Convênios aprovados` | `convenios_aprovados` | `NUMERIC(18,2)` | |

O `Content-Type` da resposta é `text/plain;charset=UTF-8`, mas o corpo é JSON UTF-8 válido. Por isso o cliente lê o JSON pelo conteúdo, sem depender do cabeçalho. A amostra tinha 587 linhas e cerca de 200 KB por mês.

### Cliente HTTP: httpx síncrono
`httpx` já vem com `fastapi[standard]`. A carga é sequencial (um mês por vez, para não sobrecarregar a API da Fazenda), então não há ganho em async. O retry com backoff exponencial (1s, 2s, 4s; até 3 tentativas para timeout/conexão/5xx/429) e o fluxo "401 → reautentica uma vez" ficam no cliente. Timeout de 60s por requisição.
- *Alternativa descartada:* `tenacity` para retry. É uma dependência a mais para um laço de poucas linhas.

### Concorrência: advisory lock do Postgres
O serviço tenta `pg_try_advisory_lock(<constante>)` numa conexão própria antes de começar. Se não conseguir, a CLI sai com erro e o endpoint responde 409. O lock vale entre processos (CLI e servidor), e o Postgres o libera sozinho se o processo morrer.
- *Alternativa descartada:* checar se existe execução `em_andamento` na tabela. Se o processo morrer, fica um registro "travado" para sempre.
- Ao adquirir o lock, o serviço marca como `falha` ("interrompida") qualquer execução que tenha ficado `em_andamento` de uma execução morta.

### Registro de execução em transação separada
`etl_execucao` é inserida e atualizada em commits próprios, fora da transação da carga. Assim o status `falha` sobrevive ao rollback dos dados.

### Disparo HTTP em segundo plano
`POST /etl/siafe` adquire o lock e cria a execução de forma síncrona (para poder responder 409 ou 202 com o id). Depois agenda a carga com `BackgroundTasks` do FastAPI, que roda no mesmo processo após a resposta.
- *Alternativa descartada:* fila (Celery/RQ). É infraestrutura demais para uma carga sob demanda e pouco frequente.
- Limitação aceita: se o servidor reiniciar durante a carga, ela é perdida. O lock é liberado, e a próxima execução marca a anterior como interrompida.

### Configuração
`pydantic-settings` lê `api/.env`. `SIAFE_PASSWORD` e `DATABASE_URL` usam `SecretStr`, para não vazarem em `repr`/logs. As mensagens de erro do cliente SIAFE incluem só método, rota e status HTTP, nunca o corpo do `POST /auth` nem cabeçalhos.

### Parâmetros da consulta
Formato confirmado: a consulta é enviada como `?params=<SIAFE_UG>,<MES>,<ANO>`, nessa ordem e separados por vírgula. O formato fica centralizado no cliente. Nomes como `ug`/`ano`/`mes` ou `parametros` geram 500 ("Parametros faltando ... Quantidade de parametros necessarios: 3").

### Comportamento observado do `/auth`
O `POST /auth` responde `{"token", "tipo"}`. De forma intermitente, responde 200 com corpo vazio, e o cliente trata isso como falha transitória (retry). Muitas autenticações seguidas parecem levar a 401, então o cliente reutiliza o token durante toda a execução.

### Testes
- Unitários com `pytest` + `respx` (mock do httpx) para o cliente e o transform. Os fixtures são **sintéticos**, só com a mesma estrutura da amostra real, porque dados reais de convênio não podem ser versionados.
- Integração do serviço/rotas contra o Postgres indicado por `TEST_DATABASE_URL`. Os testes são pulados se a variável não estiver definida. Por decisão do usuário, ela pode apontar para o mesmo banco do `DATABASE_URL` (homologação). Para proteger esse uso, a suíte **aborta** se `siafe_flexvision` já tiver dados e só faz `downgrade base` se foi ela que criou as tabelas.

## Risks / Trade-offs

- [Formato da FlexVision diferente do esperado ou mudando com o tempo] → amostra real antes da migration; validação estrita com erro claro; mapeamento centralizado.
- [Carga completa fica mais lenta a cada mês, já que o histórico cresce] → aceitável no volume atual (~47 requisições). Se ficar lento, uma change futura pode carregar só o mês corrente.
- [Endpoints `/etl/*` sem autenticação permitem que qualquer um na rede dispare cargas no SIAFE] → o lock limita a uma carga por vez; antes de expor o servidor fora da rede interna, adicionar autenticação.
- [Carga em memória] → se o volume por mês crescer muito, trocar para escrita em lotes numa tabela de staging.
- [Credenciais em `api/.env` em texto claro] → `.env*` já está no `.gitignore`. A senha do banco também aparece no `DATABASE_URL`, que deve ficar fora de logs (`SecretStr`, `hide_parameters` no engine).

## Migration Plan

1. `uv sync` com as novas dependências.
2. `uv run alembic upgrade head` para criar `etl_execucao` e `siafe_flexvision`.
3. Primeira carga: `uv run python -m app.etl.siafe`.
4. Rollback: `uv run alembic downgrade base` remove as tabelas. Nenhum dado pré-existente é afetado, já que o banco do projeto ainda não tem tabelas.
