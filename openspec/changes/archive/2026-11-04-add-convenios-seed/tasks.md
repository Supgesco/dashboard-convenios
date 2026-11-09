# Tasks

## 1. Layout declarativo e tabelas

- [x] 1.1 Criar `app/planilha/layout.py` com as estruturas (aba, coluna com letra/nome/papel/cabeçalho/opções `identificacao` e `repete`, papéis `rotulo|livre|categoria|booleano|municipio|numero_convenio|codigo|data|numero|inteiro`, regras de fim `primeira_vazia|marcador|coluna_vazia|ultima_nao_vazia`, bloco extra, regras de aba `continuacao_por_item|deslocamento_h_k|municipio_mesclado`) e a normalização de texto de cabeçalho/aba (strip, espaços e quebras colapsados, casefold); verificar com teste unitário que `"Nº do Convênio\nSIAFE - SEOBRAS "` e `"nº do convênio siafe - seobras"` normalizam igual
- [x] 1.2 Declarar as 8 abas importadas, mais `Planilha2` na lista de ignoradas, conforme o design (nomes, tabelas, cabeçalhos, início, fim, colunas com papéis, nomes harmonizados `municipio`/`numero_convenio`/`codigo_seobras`/`codigo_seiop` etc., colunas sem cabeçalho, colunas descartadas da aba 31, 2º bloco da Tomada de Contas). Verificar com teste:
  - não há nomes de coluna duplicados por tabela;
  - as letras de cada aba são contíguas;
  - nenhum nome colide com as colunas de controle;
  - toda coluna `categoria` aponta para um vocabulário existente;
  - as abas com `continuacao_por_item` têm `item` marcado como `identificacao`.
- [x] 1.3 Conferir o layout contra a planilha real com um script ad hoc no scratchpad (fora do repositório), listando por aba o cabeçalho encontrado × o esperado; corrigir até não haver divergência. Verificar que `git status` não mostra nada derivado da planilha
- [x] 1.4 Em `app/models.py`, adicionar `PlanilhaImportacao` (colunas do design, JSONB para `linhas_por_aba`, `avisos_por_motivo` e `avisos`) e gerar as 8 `Table` `planilha_*` a partir do layout. Cada uma tem `id`, `importacao_id` FK, `linha` e `linha_principal`, mais `bloco` na Tomada de Contas e `colunas_corrigidas` na 342/ACOMPANHAMENTO. Mapeamento de papel → tipo SQL: `Text` para rotulo/livre/categoria/municipio/numero_convenio/codigo, `Boolean`, `Date`, `Numeric` sem escala e `Integer`, sem as colunas descartadas. Verificar com teste que `Base.metadata.tables` contém as 9 tabelas novas com as colunas esperadas
- [x] 1.5 Gerar a migration `0002` com `alembic revision --autogenerate`, revisar e congelar, sem importar o layout; verificar num banco de teste `upgrade head`, `downgrade 0001` e `upgrade head` sem erro e que `alembic check` não acusa diferença
- [x] 1.6 Atualizar `tests/conftest.py`: o guard aborta se `planilha_importacao` ou qualquer `planilha_*` tiver dados, e os `TRUNCATE` incluem essas tabelas; verificar que `uv run pytest` passa com `TEST_DATABASE_URL` e que a suíte aborta num banco com uma linha em `planilha_importacao`

## 2. Extração

- [x] 2.1 Criar `tests/planilha_sintetica.py`, que gera um `.xlsx` sintético com as 8 abas importadas (a partir do layout) e uma Planilha2 qualquer. Conteúdo:
  - títulos, cabeçalhos de 1 e 2 linhas, nomes de aba com espaços nas pontas;
  - linhas fictícias com mesclas verticais, linhas de continuação, linhas vazias no meio, totais e quadro-resumo;
  - 2º bloco da Tomada de Contas com município mesclado;
  - linhas deslocadas e alinhadas na 342/ACOMPANHAMENTO;
  - os valores sujos do design.

  Parâmetros geram variações inválidas: aba faltando ou extra, sem Planilha2, cabeçalho trocado, coluna extra, sem linha de total. Verificar que o arquivo abre no openpyxl com as 9 abas
- [x] 2.2 Implementar `app/planilha/extracao.py`:
  - abre o arquivo com `data_only=True`, e com `data_only=False` para detectar fórmulas sem valor;
  - identifica as abas, valida cabeçalhos, delimita linhas pela regra de fim e pula linhas vazias;
  - rejeita valores fora das colunas do layout;
  - devolve `LinhaCrua(linha, bloco, celulas)` por aba, com valor original, coordenada e a marca de "parte não superior de mescla vertical";
  - erros de layout levantam exceção com aba e célula.

  Verificar com testes sobre a planilha sintética: contagem de linhas por aba, total e quadro-resumo excluídos, dois blocos da Tomada de Contas com `bloco` 1 e 2, linhas vazias puladas, marca de mescla presente nas células certas, aba com espaço no nome reconhecida, Planilha2 não lida
- [x] 2.3 Cobrir as falhas de layout com testes: aba faltando e desconhecida (mensagem lista ambas), Planilha2 ausente aceita, cabeçalho divergente (aba, célula, esperado, encontrado), diferença só de espaçamento aceita, valor na coluna L da aba Não Realinhado Expirado rejeitado, marcador de fim ausente na aba 31, arquivo inexistente e arquivo que não é xlsx

## 3. Transformação

- [x] 3.1 Implementar `app/planilha/dominios.py` com os 92 municípios oficiais do RJ (conferidos contra a lista do IBGE), os aliases do design e os vocabulários de categorias tirados da revisão atual. Ajuda um script ad hoc no scratchpad que lista os valores distintos de cada coluna categórica da planilha real; só os rótulos de categoria vão para o código, nenhum outro dado. Verificar com teste que a lista tem 92 nomes distintos e que nenhuma chave de alias colide com a chave de um nome oficial diferente do alvo
- [x] 3.2 Implementar em `app/planilha/transformacao.py` as funções por papel, que devolvem `(valor, aviso|None)`: ausência, `rotulo`, `livre`, chave de comparação, `categoria`, `booleano`, `municipio`, `numero_convenio`, `codigo`, `data`, `numero`, `inteiro`. Verificar com testes unitários todos os exemplos da spec:
  - limpeza de texto: `"\nAperibé\n"` → `"Aperibé"`; processos multilinha; `-`/`.`/`#REF!` → nulo sem aviso;
  - categorias: `"Vigente "`/`"vigente "` → `"Vigente"`; `"Sim "` → `true`; 22 → `"22"` + aviso;
  - municípios: as três grafias de São José do Vale do Rio Preto; `"Sâo Fidélis"` e `"RioClaro"`; município desconhecido → aviso;
  - nº do convênio: `"143/14"` → `"143/2014"`; `"012/A/2013"` → `"012-A/2013"`;
  - códigos: 7783, `"007783"` e `"'007695"` → 6 dígitos; `"210014/ 007645"` → nulo + aviso;
  - números e datas: `991879.4210000001` → `Decimal("991879.421")`; `"
2.036.643,30
"` → `Decimal("2036643.30")`; `"10.5"` → `Decimal("10.5")`; `"3"` → 3 em inteiro; `"Verificar NL"` em número → nulo + aviso
- [x] 3.3 Implementar as regras por aba (continuação por Item, município mesclado, deslocamento H–K e colunas repetidas) e a função por aba que aplica tudo e devolve linhas prontas para inserir e avisos `{aba, celula, coluna, motivo, valor}`. Verificar com testes sobre `LinhaCrua` montadas em código:
  - continuação: a linha herda item/município/nº/códigos, mas não os valores iniciais; `linha_principal` vale `false`; continuação antes de qualquer principal → erro;
  - Tomada de Contas: município mesclado propagado;
  - deslocamento: linha deslocada → vigência data + situação + `colunas_corrigidas`; linha alinhada intacta; valor em K numa linha deslocada → aviso;
  - aba 31: repetição divergente de Município/Nº → aviso, as colunas descartadas ausentes do resultado e `item_homologacao` gravado sem comparação com o Item
- [x] 3.4 Integrar extração e transformação num teste sobre a planilha sintética e verificar, por aba, a contagem de linhas e de linhas principais e a ausência de dupla contagem: a soma de `valor_total_inicial` da 89 sintética é igual à soma dos convênios fictícios

## 4. Carga, orquestração e CLI

- [x] 4.1 Implementar `app/etl/planilha.py`:
  - `reservar()`: advisory lock com chave própria, órfãos → `falha`, registro com nome do arquivo e SHA-256;
  - `executar()`: extração → transformação em memória; `DELETE` nas 8 tabelas + bulk `INSERT` numa transação; finalização com `linhas_por_aba`, `total_avisos`, `avisos_por_motivo`, avisos limitados a 1000 ou erro truncado; lock liberado no `finally`.

  Verificar com testes de integração:
  - o sucesso grava as 8 tabelas com `importacao_id`, valores normalizados e registro `sucesso`, sem nada da Planilha2;
  - uma segunda execução substitui tudo;
  - uma falha de layout na última aba não altera nenhuma tabela e grava `falha` com a mensagem
- [x] 4.2 Verificar com testes de integração a concorrência: com o lock da planilha ocupado, uma nova execução é recusada sem ler o arquivo; com o lock do SIAFE (`LOCK_ID` de `app/etl/siafe.py`) ocupado, o ETL da planilha roda normalmente; um registro `em_andamento` órfão é marcado como `falha` pela execução seguinte
- [x] 4.3 Adicionar o entry point `uv run python -m app.etl.planilha <arquivo.xlsx>` (argparse; saída 0/1/2; resumo com linhas por aba, avisos por motivo e os primeiros 20 avisos); verificar com testes chamando `main()` os casos sucesso (0), arquivo inexistente (1, sem registro), layout inválido (1) e lock ocupado (2)
- [x] 4.4 Atualizar o `CLAUDE.md` (estrutura de `app/planilha/` com extração/transformação/domínios, `app/etl/planilha.py` e o comando do ETL) e o `api/README.md` (como rodar o ETL da planilha e onde colocar o arquivo, sem dados reais); verificar que o comando documentado executa como escrito

## 5. Verificação integrada

- [x] 5.1 Num banco local, rodar `uv run alembic upgrade head` e o ETL com a planilha real `data/Enzo - Planilha Geral Somando Forças_Situação com prestaçao de contas Revisão_ 11.08.2026.xlsx`. Verificar:
  - saída 0;
  - contagens por aba iguais às do design (342, 97, 34, 335, 5, 11, 32, 55) e nenhuma tabela da Planilha2;
  - em `planilha_convenios_transferidos`, 89 linhas principais com 89 itens distintos e a maior `linha` igual a 100;
  - 47 linhas com `colunas_corrigidas` na 342 e 14 na ACOMPANHAMENTO;
  - nenhum aviso `municipio_desconhecido`;
  - `SELECT DISTINCT` de cada coluna categórica só com valores canônicos (ou valores com aviso correspondente);
  - os avisos restantes revisados e plausíveis (ex.: "Verificar NL" na Prest de Contas, 22 em Status Convênio, `"210014/ 007645"`).
- [x] 5.2 Conferir por amostragem três linhas por aba contra a planilha aberta no Excel, inclusive uma continuação da 89, uma linha deslocada da 342 e uma da Tomada de Contas com município mesclado. Medir e anotar no resumo da implementação quantos `numero_convenio` se repetem entre municípios diferentes, como insumo para o futuro modelo integrado
- [x] 5.3 Rodar o ETL duas vezes seguidas e verificar que as contagens não dobram e que `planilha_importacao` tem dois registros `sucesso` com o mesmo SHA-256; rodar `uv run pytest` completo e verificar que passa
