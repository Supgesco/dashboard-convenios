# API — Dashboard Convênios

Back-end em FastAPI, com duas cargas sob demanda para o Postgres: a consulta FlexVision do SIAFE e a planilha geral de convênios (Somando Forças).

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
uv run alembic upgrade head          # cria as tabelas e as views do cruzamento
uv run python -m app.etl.siafe       # carga completa (2023-01 até o mês atual), sobrescreve a anterior
uv run python -m app.etl.planilha ../data/<planilha>.xlsx  # ETL da planilha, sobrescreve a anterior
uv run fastapi dev app/main.py       # servidor de desenvolvimento
```

Endpoints:

- `POST /etl/siafe`: inicia a carga em segundo plano. Responde `202 {"execucao_id", "status"}`, ou `409` se já houver carga em andamento.
- `GET /etl/siafe/status`: retorna a execução mais recente (`status`: `em_andamento` | `sucesso` | `falha`), ou `404` se nenhuma carga foi feita.

Cada carga substitui todos os registros de `siafe_flexvision` numa única transação. Se a carga falhar, os dados anteriores continuam intactos e a falha fica registrada em `etl_execucao`.

## ETL da planilha

Coloque o `.xlsx` em `data/` (a pasta é ignorada pelo git, e a planilha tem dados reais, que nunca devem ser versionados) e rode, a partir de `api/`:

```bash
uv run python -m app.etl.planilha "../data/<planilha>.xlsx"
```

O comando valida o layout (abas, cabeçalhos, fim dos dados), normaliza os dados (textos, categorias, municípios, nº do convênio `NNN/AAAA`, códigos SEOBRAS/SEIOP com 6 dígitos) e substitui o conteúdo das 8 tabelas `planilha_*` numa única transação. A aba `Planilha2` é ignorada.

- Código de saída: `0` sucesso, `1` falha (arquivo inválido ou layout diferente do esperado: nada é alterado) e `2` outra importação em andamento.
- Valores que não puderam ser aproveitados viram nulo e geram **avisos** (aba, célula, motivo, valor original). A CLI mostra o resumo por motivo e os primeiros 20. Todos ficam em `planilha_importacao.avisos`, junto com o nome e o SHA-256 do arquivo.
- Nas abas em que um convênio ocupa várias linhas, use `linha_principal = true` para contar ou somar uma vez por convênio.

## Cruzamento SIAFE x planilha

A migration `0003` cria views (calculadas na leitura, sem etapa de carga) que ligam os convênios da aba 342 às contas correntes do SIAFE. O convênio é identificado pela chave `numero_convenio` + `municipio`.

| View | Conteúdo |
|---|---|
| `v_convenio` | um convênio por chave da 342, com status, fase (`vigente`/`realinhado`/`historico`) e os códigos SEOBRAS/SEIOP escolhidos (precedência 31 > 89 > 342 > abas auxiliares) |
| `v_convenio_codigo` | código distinto de cada convênio, com `tipos` |
| `v_convenio_registro` | cada linha do SIAFE das contas do convênio, por ano e mês, sem agregação |
| `v_convenio_saldo_codigo` | saldos do mês por convênio e código |
| `v_convenio_saldo` | saldos do mês por convênio (nunca some meses: cada mês é uma foto do estoque) |
| `v_cruzamento_falha` | falhas de vínculo por `motivo`, com os saldos do último mês quando envolvem uma conta |

`v_cruzamento_linha` e `v_cruzamento_codigo_origem` são camadas intermediárias. Para totais gerais, some a partir das contas distintas do SIAFE: um código em mais de um convênio (`codigo_em_mais_de_um_convenio`) aparece em cada um deles.

## Testes

```bash
uv run pytest                        # sem TEST_DATABASE_URL, os testes de integração são pulados
```

Os testes de integração truncam `siafe_flexvision`, `etl_execucao`, `planilha_importacao` e as tabelas `planilha_*`. A suíte aborta se alguma delas (exceto `etl_execucao`) já tiver dados.
