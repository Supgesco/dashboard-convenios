# Tasks

## 1. Views do painel (migration 0004)

- [x] 1.1 Criar `api/alembic/versions/0004_cria_views_do_painel.py` (`down_revision = "0003"`) no padrão da `0003` (lista `VIEWS`, `CREATE` em ordem, `DROP` na ordem inversa), com a view `v_recorte_convenio` da Decisão 1 (recorte, chave, status, `situacao_vigencia` da linha da 342 e fase). Verificar num banco de teste que `uv run alembic upgrade head`, `downgrade 0003`, `upgrade head` e `uv run alembic check` passam
- [x] 1.2 Adicionar à `0004` a view `v_valor_contratual` da Decisão 2 (recortes `31` e `89`, soma de todas as linhas da chave, `base` escolhida por convênio, colunas de investido diferentes por aba). Verificar de novo o ciclo `upgrade`/`downgrade`/`check`
- [x] 1.3 Criar `api/tests/test_painel_views.py`, reaproveitando os helpers de dados sintéticos de `tests/test_cruzamento.py` (extrair para um módulo comum se for preciso). Cobrir:
  - os recortes aninhados e a linha da 31 sem par na 342;
  - realinhado vs. inicial escolhido por convênio, inclusive com a flag `realinhado` discordando do valor;
  - a linha de continuação somada;
  - o convênio sem valores com nulo;
  - as colunas de investido da 31 (`total_investido`) e da 89 (`total_investido_estado`).

  Verificar com `uv run pytest tests/test_painel_views.py` e `TEST_DATABASE_URL`

## 2. Consultas do painel

- [x] 2.1 Criar `api/app/painel/consultas.py` com funções sobre `Connection` e SQL literal parametrizado (Decisões 3 e 7):
  - saldos do mês com códigos distintos;
  - mês anterior;
  - cobertura;
  - valores contratuais agregados com percentual por quociente de somas;
  - situação do 342;
  - série;
  - ranking por município com `codigo_compartilhado`;
  - lista de convênios;
  - datas das cargas;
  - último mês disponível.

  Valores arredondados a 2 casas no SQL, e nulos preservados. Verificar com `api/tests/test_painel_consultas.py` sobre dados sintéticos, cobrindo o código compartilhado (contado uma vez no total e duas no ranking), a virada de ano do mês anterior, a cobertura com conta sem convênio, o percentual 87,5% do cenário da spec e o repasse zero
- [x] 2.2 Adicionar a normalização do filtro de municípios (casamento por `chave()` contra `MUNICIPIO_POR_CHAVE`, nomes canônicos, sem repetição e com a lista dos não reconhecidos). Verificar com testes unitários sem banco (grafia sem acento, alias, inexistente, repetido)

## 3. Router `/painel`

- [x] 3.1 Criar `api/app/routers/painel.py`:
  - os 4 endpoints `GET` (`/resumo`, `/serie`, `/municipios`, `/convenios`);
  - os modelos Pydantic de resposta com números como float e campos nulos explícitos;
  - a validação de `recorte`, de `municipio` (422 com os inválidos) e de `ano`/`mes` juntos (422);
  - as dependências `get_engine` (reaproveitada do router de ETL) e `get_hoje` (data em America/Sao_Paulo).

  Incluir o router em `app/main.py`. Verificar que `uv run fastapi dev app/main.py` sobe e que `/docs` lista os 4 endpoints
- [x] 3.2 Criar `api/tests/test_routers_painel.py` com `TestClient` e `dependency_overrides` (engine de teste e `get_hoje` fixo), um teste por cenário da spec `painel-gerencial`:
  - os 422 de recorte, município e `ano` sem `mes`;
  - o mês padrão;
  - o mês sem dados com `ultimo_mes_disponivel`;
  - as datas das cargas com a última falha;
  - a cobertura nula com filtro;
  - o bloco contratual nulo no 342 e a situação nula no 31;
  - a série vazia;
  - o convênio sem código na lista;
  - a reimportação refletida.

  Verificar com `uv run pytest`, com a suíte inteira verde

## 4. Conferência com os dados reais e documentação

- [x] 4.1 Aplicar a `0004` no banco local e conferir os endpoints contra os números da exploração, com um script ad hoc no scratchpad, fora do repositório, mostrando só contagens e relações, sem valores monetários:
  - 31 convênios no recorte `31`, 89 no `89` e 342 no `342`;
  - a série de 2023-01 até o mês corrente;
  - a soma do ranking ≥ o total do resumo, com igualdade quando nenhum município tem `codigo_compartilhado`;
  - o vinculado ≤ o total na cobertura;
  - valor total = repasse + contrapartida na maioria dos convênios, como na exploração.

  Explicar qualquer diferença antes de seguir. Verificar que `git status` não mostra nada derivado dos dados
- [x] 4.2 Atualizar `CLAUDE.md` (Layout: `app/routers/painel.py`, `app/painel/` e a `0004`, e a regra de recriar views ao alterar `planilha_*` estendida à `0004`) e `api/README.md` (seção do painel com os endpoints e parâmetros). Verificar que os comandos citados continuam válidos

## 5. Paginação e ordenação

- [x] 5.1 Em `api/app/painel/consultas.py`, `ranking_municipios` e `lista_convenios` recebem `pagina`, `tamanho` e `ordem` (Decisão 8):
  - whitelist de campos → `ORDER BY <coluna> ASC|DESC NULLS LAST` com desempate;
  - `LIMIT`/`OFFSET`;
  - `total` por `count(*) OVER ()`, com fallback para a página vazia.

  Verificar em `api/tests/test_painel_consultas.py`: ordem decrescente com nulos por último, desempate estável entre valores iguais, última página parcial e página além do fim com `total` correto
- [x] 5.2 Em `api/app/routers/painel.py`, adicionar os parâmetros `pagina` (≥ 1, padrão 1), `tamanho` (1 a 100, padrão 20) e `ordem`, com 422 para campo fora da whitelist, e os campos `pagina`, `tamanho` e `total` nos envelopes de `/painel/municipios` e `/painel/convenios`. A série continua sem paginação. Verificar em `api/tests/test_routers_painel.py` com um teste por cenário dos requisitos "Paginação das listas" e "Ordenação das listas paginadas", ajustando os testes existentes do ranking e da lista ao novo envelope, e com `uv run pytest` verde
- [x] 5.3 Atualizar a seção do painel em `api/README.md` (parâmetros `pagina`, `tamanho` e `ordem`, os campos de cada whitelist e o envelope) e o item de `app/routers/painel.py` no `CLAUDE.md`. Conferir contra a homologação com um script no scratchpad, só com contagens:
  - `total` do ranking 342 = 83 e da lista 342 = 342;
  - as páginas concatenadas iguais à lista sem paginação (`tamanho=100`);
  - `ordem=-a_pagar` não crescente, com nulos no fim

## Workflow follow-up

- Arquivar a change com `/opsx:archive` depois da revisão, gerando `openspec/specs/painel-gerencial/spec.md`.
