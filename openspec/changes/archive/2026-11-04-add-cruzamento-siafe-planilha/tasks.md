# Tasks

## 1. Migration e base dos testes

- [x] 1.1 Criar `api/alembic/versions/0003_cria_views_do_cruzamento.py` (`down_revision = "0002"`) com `upgrade`/`downgrade` vazios, a ser preenchidos pelas views dos grupos seguintes. O SQL fica literal, sem importar o layout nem os modelos. Verificar num banco de teste que `uv run alembic upgrade head` e `uv run alembic downgrade 0002` rodam sem erro
- [x] 1.2 Criar `api/tests/test_cruzamento.py` com helpers de dados sintéticos sobre o `db_engine` do `conftest`:
  - um `etl_execucao` e um `planilha_importacao` para as FKs;
  - funções que inserem linhas mínimas numa tabela `planilha_*` por nome de aba (via `TABELAS_PLANILHA`, preenchendo `linha` e `linha_principal`) e linhas em `siafe_flexvision` por (ano, mês, conta corrente, 4 saldos).

  Usar só códigos, números e municípios fictícios. Verificar com um teste de fumaça que as linhas inseridas são lidas de volta, e que o `TRUNCATE` do `conftest` limpa entre testes

## 2. Convênio, fase e códigos

- [x] 2.1 Adicionar à `0003` as views `v_cruzamento_codigo_origem` (unpivot das 8 abas com aba, prioridade, linha, chave, tipo e código, conforme a Decisão 2) e `v_convenio`. `v_convenio` tem a chave, a linha da 342, o status, a fase, os dois códigos e a aba de origem de cada código, com `DISTINCT ON` pela chave, fase por `EXISTS` e código pelo primeiro candidato `ORDER BY prioridade, linha`. Os `DROP VIEW` do `downgrade` vão na ordem inversa. Verificar que `upgrade head`, `downgrade 0002`, `upgrade head` e `uv run alembic check` passam sem diferença
- [x] 2.2 Testes dos requisitos "Convênio identificado pela aba 342", "Fase do convênio", "Precedência do código entre as abas do funil" e "Abas auxiliares como fonte complementar de código", um teste por cenário da spec. Incluir a linha de continuação da 89 (`linha_principal = false`) com o mesmo código, que não pode gerar divergência nem duplicar o convênio. Verificar com `uv run pytest tests/test_cruzamento.py` e `TEST_DATABASE_URL`

## 3. Registros e saldos mensais

- [x] 3.1 Adicionar à `0003`, nesta ordem e com os `DROP` correspondentes, as views:
  - `v_convenio_codigo`: código distinto por convênio, com `tipos text[]`;
  - `v_convenio_registro`: junção com `siafe_flexvision`, linha a linha, com chave, `ano`, `mes`, `conta_corrente`, `tipos`, `conta_contabil`, `conta_contabil_nome` e os 4 saldos;
  - `v_convenio_saldo_codigo`: `SUM` das 4 colunas de `v_convenio_registro` por convênio, código, ano e mês;
  - `v_convenio_saldo`: soma por convênio, ano e mês.

  Verificar de novo o ciclo `upgrade`/`downgrade`/`check`
- [x] 3.2 Testes do requisito "Registros mensais das contas do convênio", com todos os cenários, incluindo:
  - linha zerada mantida;
  - código nos dois tipos com registro único;
  - soma dos registros do mês igual a `v_convenio_saldo`.

  Verificar com `uv run pytest tests/test_cruzamento.py`
- [x] 3.3 Testes dos requisitos "Saldo mensal por código" e "Saldo mensal por convênio", com todos os cenários, mais:
  - duas contas contábeis da mesma conta no mesmo mês, somadas dentro do mês;
  - convênio sem código, que não aparece em `v_convenio_saldo`.

  Verificar com `uv run pytest tests/test_cruzamento.py`

## 4. Falhas de vínculo

- [x] 4.1 Adicionar à `0003` a view `v_cruzamento_falha`, com os 8 motivos da tabela da Decisão 2 e as colunas comuns (`motivo`, chave, `aba`, `linha`, `tipo_codigo`, `codigo`, `detalhe`, `ano`, `mes` e os 4 saldos). O último mês é `max(ano * 100 + mes)` e vem nulo com o SIAFE vazio. Verificar de novo o ciclo `upgrade`/`downgrade`/`check`
- [x] 4.2 Testes dos requisitos "Contas do SIAFE sem convênio", "Convênios sem código e códigos ausentes do SIAFE", "Código em mais de um convênio" e "Linhas de abas sem convênio na 342", e das falhas de chave da 342 e de `codigo_divergente` já exercitadas no grupo 2. Um teste por cenário. Verificar com `uv run pytest tests/test_cruzamento.py`
- [x] 4.3 Testes do requisito "Cruzamento calculado sobre os dados carregados":
  - SIAFE vazio com a planilha carregada (convênios sem saldo e códigos como `codigo_fora_do_siafe`);
  - planilha vazia com o SIAFE carregado (todas as contas como `conta_siafe_sem_convenio`);
  - as duas fontes vazias (todas as views sem linhas e sem erro);
  - troca do conteúdo de uma `planilha_*` refletida na consulta seguinte.

  Verificar com `uv run pytest`, com a suíte inteira verde

## 5. Conferência com os dados reais e documentação

- [x] 5.1 Aplicar a migration no banco local e conferir as views contra os números da exploração, com um script ad hoc no scratchpad, fora do repositório:
  - 352 contas distintas;
  - cerca de 287 ligadas a algum convênio e 65 em `conta_siafe_sem_convenio`;
  - 31 convênios `vigente` e 58 `realinhado` (89 − 31);
  - nenhuma `chave_repetida_342`;
  - os 4 casos de código divergente entre abas;
  - o número de linhas de `v_convenio_registro` igual ao de linhas do SIAFE das contas com par, salvo códigos em mais de um convênio, que multiplicam as linhas.

  Explicar qualquer diferença (por exemplo, contas recuperadas pelas abas auxiliares) antes de seguir. Verificar que `git status` não mostra nada derivado dos dados
- [x] 5.2 Atualizar `CLAUDE.md` (seção Layout: as views do cruzamento na `0003`, fora de `Base.metadata`, e a regra de recriá-las ao alterar uma `planilha_*`) e `api/README.md`, se ele listar o esquema. Verificar que os comandos citados continuam válidos

## Workflow follow-up

- Arquivar a change com `/opsx:archive` depois da revisão, gerando `openspec/specs/convenios-siafe-cruzamento/spec.md`.
