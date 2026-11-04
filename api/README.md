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

## Painel gerencial

Endpoints de leitura (`GET`) da tela inicial, em `app/routers/painel.py`, com as somas em `app/painel/consultas.py`. A migration `0004` cria duas views sobre as da `0003`:

| View | Conteúdo |
|---|---|
| `v_recorte_convenio` | convênios de cada recorte: `31` (vigentes) ⊂ `89` (primeiro repasse) ⊂ `342` (todos), com status e situação da vigência da linha da 342 |
| `v_valor_contratual` | valores contratuais por convênio nos recortes `31` e `89`, cada um da sua aba, somando as linhas de continuação; `base` diz se vieram do grupo realinhado ou do inicial |

| Endpoint | Conteúdo |
|---|---|
| `/painel/resumo` | convênios do recorte; 4 saldos SIAFE do mês, mês anterior e cobertura (sem filtro de município); valores contratuais (31/89) ou contagem por status e situação (342); datas das últimas cargas com sucesso |
| `/painel/serie` | os 4 saldos de cada mês carregado |
| `/painel/municipios` | ranking por município, com `codigo_compartilhado` |
| `/painel/convenios` | lista de convênios com códigos, saldos do mês e valores contratuais |

Parâmetros comuns: `recorte` (`31`, `89` ou `342`; padrão `31`) e `municipio` (repetível, casado sem acento/caixa contra os 92 municípios; inválido → 422). `resumo`, `municipios` e `convenios` aceitam `ano` e `mes` juntos; sem eles, o mês corrente (America/Sao_Paulo). Se o SIAFE não tem o mês, `siafe` vem `null` e `referencia.ultimo_mes_disponivel` indica o último carregado.

`municipios` e `convenios` são paginados e ordenados no servidor:

- `pagina` (a partir de 1, padrão 1) e `tamanho` (1 a 100, padrão 20); fora disso → 422. Página além do fim traz `itens` vazio com o `total` certo.
- `ordem`: um campo, com `-` na frente para decrescente (`ordem=-a_pagar`). Nulos ficam por último, e o desempate é por município e número do convênio. Sem `ordem`, município e depois número. Campo fora da lista → 422.
  - ranking: `municipio`, `convenios`, `a_pagar`, `a_comprovar`, `a_aprovar`, `aprovados`, `valor_total`, `repasse_estado`, `contrapartida`, `investido_estado`, `a_repassar`, `execucao_pct`;
  - lista: `numero_convenio`, `municipio`, `status`, `fase` e os mesmos saldos e valores contratuais.
- Envelope: `{recorte, ano, mes, municipios, pagina, tamanho, total, itens}`, com `total` contando os itens do recorte e do filtro (não reais). A série não é paginada.

Os saldos somam o conjunto distinto de códigos dos convênios selecionados (um código de dois convênios conta uma vez no total, mas entra em cada linha do ranking ou da lista). O percentual de execução é investido ÷ repasse do Estado sobre as somas. Valores ausentes vêm `null`, nunca zero.

## Testes

```bash
uv run pytest                        # sem TEST_DATABASE_URL, os testes de integração são pulados
```

Os testes de integração truncam `siafe_flexvision`, `etl_execucao`, `planilha_importacao` e as tabelas `planilha_*`. A suíte aborta se alguma delas (exceto `etl_execucao`) já tiver dados.
