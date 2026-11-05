# Tasks

## 1. Consultas do detalhe do convênio

- [x] 1.1 Adicionar a `api/app/painel/consultas.py` as consultas `convenio` e `compartilhamentos` da Decisão 3:
  - `convenio` traz identificação, objeto, vigência final, situação da vigência e recortes, e devolve `None` quando a chave não existe;
  - `compartilhamentos` traz os outros convênios com código em comum.

  Verificar em `api/tests/test_painel_consultas.py`, com dados sintéticos, os seguintes casos:
  - convênio vigente com recortes `31`, `89` e `342`;
  - convênio histórico só com `342`;
  - mesmo número em dois municípios;
  - chave inexistente → `None`;
  - código compartilhado citando o outro convênio e o código;
  - convênio sem compartilhamento → lista vazia.
- [x] 1.2 Adicionar `saldos_convenio`, `serie_convenio` e `contratual_convenio`, reaproveitando `_COD`, `_SOMA_SALDOS` e o arredondamento da lista (Decisões 3 e 4). Verificar nos mesmos testes:
  - código repetido como SEOBRAS e SEIOP contado uma vez;
  - mês sem dados → nulos;
  - série com um ponto por mês carregado e nulos antes da primeira linha do convênio;
  - convênio sem código com série toda nula;
  - blocos `31` e `89` com valores diferentes;
  - convênio histórico sem blocos contratuais.

  A suíte existente de `saldos` e `serie` deve continuar passando sem alteração.

## 2. Endpoint `GET /painel/convenio`

- [x] 2.1 Adicionar a `api/app/routers/painel.py` o endpoint `GET /painel/convenio` (Decisões 1, 2 e 5):
  - `numero` e `municipio` obrigatórios, normalizados com `transformacao.numero_convenio` e `normalizar_municipios`;
  - 422 para número inválido, município não reconhecido ou parâmetro ausente, e 404 para chave inexistente;
  - `ano`/`mes` pela dependência `get_mes`;
  - mês anterior e "mês sem dados → nulo" como no resumo;
  - modelos `Saldos`, `Contratual` e `PontoSerie` reaproveitados.

  Verificar em `api/tests/test_routers_painel.py` cada cenário dos requisitos de detalhe do delta de `painel-gerencial`:
  - convênio encontrado;
  - grafias `143/14` e `paraty`;
  - mesmo número em outro município;
  - 404;
  - entradas inválidas;
  - código compartilhado;
  - saldos do mês e do anterior;
  - mês sem dados;
  - contratual nas duas abas e só na 342;
  - série.

  Verificar também que `recorte` e o `municipio` repetível não alteram a resposta.
- [x] 2.2 Documentar o endpoint na seção "Painel gerencial" de `api/README.md` (parâmetros, 404/422 e formato) e no item do router em `CLAUDE.md`. Verificar que `uv run pytest` passa com `TEST_DATABASE_URL` e que `/docs` mostra a rota com a descrição dos parâmetros

## 3. Histórico de cargas `GET /etl/siafe/execucoes`

- [x] 3.1 Adicionar a `api/app/routers/etl.py` o endpoint `GET /etl/siafe/execucoes` da Decisão 6:
  - `pagina` ≥ 1 (padrão 1) e `tamanho` 1–100 (padrão 20);
  - `ORDER BY id DESC` com `LIMIT/OFFSET` e `total` por `count(*)`;
  - item no modelo `ExecucaoStatus` e envelope `{pagina, tamanho, total, itens}`.

  Verificar nos testes do router de ETL, com execuções sintéticas em `etl_execucao`:
  - 3 execuções, a mais recente em andamento primeiro;
  - 25 execuções com `pagina=2` → 5 itens e `total` 25;
  - nenhuma execução → 200, lista vazia e `total` 0;
  - `tamanho=0`, `tamanho=101` e `pagina=0` → 422;
  - o executor de carga não é chamado;
  - uma falha registrada por `SiafeAuthError` sintética aparece com `erro` sem usuário, senha nem token.
- [x] 3.2 Documentar em `api/README.md`:
  - o endpoint de histórico;
  - um aviso de que a API não tem autenticação e só pode rodar em rede interna, citando o `POST /etl/siafe` e o risco de logins repetidos no SIAFE.

  Atualizar o item do router de ETL em `CLAUDE.md`. Verificar que `uv run pytest` passa por completo com `TEST_DATABASE_URL`

## 4. Conferência com dados reais

- [x] 4.1 Com a API apontada para a homologação, só leitura e por HTTP, rodar um script no scratchpad que imprima só contagens e relações, sem valores nem textos:
  - para os primeiros convênios de `/painel/convenios?recorte=342`, o detalhe responde 200, o número de pontos da série é igual ao de `/painel/serie`, e os saldos do mês batem com a linha da lista;
  - o histórico de `/etl/siafe/execucoes` tem `total` igual ao número de execuções paginadas, e o primeiro item é igual a `/etl/siafe/status`.

  Registrar o resultado no resumo da task, sem copiar dados.

  Resultado (2026-11-04, `db_convenios_homo`):
  - os 40 primeiros convênios do recorte `342` responderam 200;
  - nos 40, a série tem os mesmos 47 pontos de `/painel/serie`, os saldos do mês são iguais aos da lista, a fase confere, `342` está nos recortes e o contratual vem vazio só nos históricos;
  - nos 20 primeiros do recorte `89`, o bloco `89` do detalhe é igual à linha da lista;
  - chave inexistente → 404 e número inválido → 422;
  - o histórico tem `total` 3, igual às páginas de 7 concatenadas, com ids decrescentes e sem repetição, e o primeiro item é igual a `/etl/siafe/status`.

## Workflow follow-up

- Arquivar a change depois da revisão, sincronizando os deltas de `painel-gerencial` e `siafe-ingestion`.
- Em seguida, propor `add-frontend-inicial` (React + Tailwind, 5 telas) sobre a API aceita.
