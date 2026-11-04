# Design

## Context

O back-end já tem uma carga sob demanda (SIAFE → `siafe_flexvision`) com o padrão que este ETL reaproveita: advisory lock, registro de execução em transações próprias, extração completa em memória e `DELETE` + `INSERT` numa transação só (ver `app/etl/siafe.py`). `openpyxl` já é dependência.

A planilha (revisão 11/08/2026, ~300 KB) foi inspecionada localmente; nada dela entra no repositório. Estrutura:

| Aba | Cabeçalho | Dados | Fim dos dados | Particularidades |
|---|---|---|---|---|
| `342 Convênios ` | linha 2 (B–AB); A sem cabeçalho | 3–344 | 1ª linha vazia (depois vêm legendas) | A e D–L ocultas; H–K deslocadas em 47 linhas |
| `89 Convênios ` | linhas 2 (grupos) e 3 | 4–100: 89 convênios em 97 linhas | linha com A = "Total Geral Executado" (seguida de quadro-resumo) | 8 convênios realinhados ocupam 2+ linhas (continuações nas linhas 8, 10, 12, 13, 22, 32, 47 e 80), mescladas de A a AI, menos F, que fica vazia na continuação; AH sem cabeçalho |
| `31 Convênios Vigentes  2025` | linhas 2 (grupos) e 3 | 4–37 | linha com A = "Total Geral" | cada convênio ocupa 2–3 linhas mescladas; K sem cabeçalho; M, N e W repetem Município e Nº; L ("Item") é a numeração própria da seção de homologação, defasada da coluna A e quase toda `#REF!` |
| `Prest de Contas Conv_Execução  ` | linha 3 | 4–356 | última linha não vazia | uma linha por parcela, com A–F mescladas por convênio (até 10 linhas); linhas vazias entre convênios (154–159, 260–265, 270–275); O sem cabeçalho com 1 valor |
| `Realinhado sem Exec_Expirado` | linha 3 (A–AC) | 4–8 | 1ª linha vazia (depois, nota "Ação: …") | |
| `Não Realinhado Expirado  ` | linha 1 (A–K) | 2–12 | 1ª linha vazia (depois, nota) | |
| `Tomada de Contas ` | linha 3 (A–H) | 4–29 e 33–38 | bloco 1: 1ª linha vazia; bloco 2: linha sem OBJETO (contagens/soma) | 2º bloco com título e cabeçalho repetidos (linhas 31–32); município mesclado em A7:A11, A15:A18, A20:A24, A26:A28, A34:A35, A37:A38 |
| `Planilha2` | nenhum | 1–2 | — | rascunho copiado da aba 31; **não importada** |
| `ACOMPANHAMENTO ESPECIAL` | linha 2 (B–AB), igual à 342 | 3–57 | 1ª linha vazia | A oculta; H–K deslocadas em 14 linhas |

Sujeira observada que a transformação trata:
- **Municípios**: maiúsculas e minúsculas misturadas, espaços e `\n` nas pontas, abreviações (`São J Vale do Rio Preto`, `SÃO J. DO V. DO RIO PRETO`, `São F Do Itabapoana`, `COMENDADOR L. GASPARIAN`, `ENGENHEIRO P. DE FRONTIN`) e erros de digitação (`Sâo Fidélis`, `RioClaro`).
- **Nº do convênio**: `999/9999` na 342/ACOMPANHAMENTO e `999/99` nas outras abas, além de `999-A/9999`, `999/A/9999` e espaço no fim.
- **Códigos**: SEOBRAS como inteiro (7783), texto com zeros (`"007783"`) ou com apóstrofo (`"'007695"`); SEIOP como inteiro ou texto; `-` para ausente; uma célula com dois códigos (`"210014/ 007645"`). Os rótulos mudam entre abas: Nº SIAFEM/Nº SIAFE na 342 equivalem a SEOBRAS/SEIOP na 89 (mesmo convênio 143/2014: 7783 ↔ `"007783"`, 210044 ↔ 210044).
- **Categorias**: `"Vigente"`/`"Vigente "`/`"vigente "`, `"Em Andamento "`/`"Em andamento "`, `"Não Repassado"`/`"Não repassado "`, `"100%Executado"`/`"100% Executado"`, `"Sim"`/`"Sim "`/`"Não "`.
- **Deslocamento** nas abas 342/ACOMPANHAMENTO, padrão único por linha. Na 342: 47 linhas com data em H e situação em I (J e K vazias); 7 alinhadas (data em I); 288 com H–K vazias. Na ACOMPANHAMENTO: 14 deslocadas e 41 vazias.
- **Lixo**: `.` e `;` sozinhos em células, `#REF!` de fórmulas quebradas, o número 22 em Status Convênio.

## Goals / Non-Goals

**Goals:**
- ETL com etapas separadas e testáveis isoladamente: extração (I/O + validação de layout), transformação (funções puras sem banco) e carga.
- Um único lugar, o layout declarativo, define abas, tabelas, colunas, papéis de normalização e regras de fim. Modelos, extração, transformação e testes saem dele.
- Falhar cedo e com precisão (aba + célula) quando o layout mudar; tolerar sujeira de conteúdo com avisos.
- Normalização conservadora e determinística: só mapeamentos explícitos (vocabulários, aliases), sem casamento aproximado.

**Non-Goals:**
- Modelo integrado (uma tabela de convênios unindo as abas) e deduplicação entre abas. As tabelas mantêm a forma de cada aba, e a chave normalizada prepara a integração.
- Código IBGE do município, vínculo com `siafe_flexvision`, cores e comentários das células.
- Aceitar revisões com estrutura diferente sem mudar código.

## Decisions

### 1. Pipeline em três etapas
- `app/planilha/extracao.py`: abre o arquivo e valida abas, cabeçalhos, fim dos dados e células fora do layout. Devolve, por aba, linhas cruas `LinhaCrua(linha, bloco, celulas)`, em que cada célula traz valor openpyxl, coordenada e se é parte não superior de uma mescla vertical. Não converte nada.
- `app/planilha/transformacao.py`: funções puras `LinhaCrua[] → (linhas_tratadas[], avisos[])` por aba. Aplicam a limpeza/conversão por papel da coluna e as regras de aba (continuação, deslocamento, colunas repetidas). Não tocam no banco.
- `app/planilha/dominios.py`: municípios do RJ com aliases e vocabulários das categorias.
- `app/etl/planilha.py`: orquestra (lock, registro, extração → transformação → carga) e a CLI.

Separar extração e transformação permite testar as regras de normalização com listas de valores, sem montar xlsx, e manter a validação de layout (erro fatal) apartada da sujeira de conteúdo (aviso).
- *Alternativa*: camada crua (staging) + normalizada. Descartada por decisão do usuário: só tabelas normalizadas. O original de tudo o que a transformação não aproveita fica nos avisos, e o arquivo (com hash registrado) permite reprocessar.

### 2. Layout declarativo (`app/planilha/layout.py`)
Cada aba declara: nome normalizado, tabela, linha(s) de cabeçalho, primeira linha de dados, regra de fim, bloco extra (Tomada de Contas), regras de aba (`continuacao_por_item`, `deslocamento_h_k`, `municipio_mesclado`) e colunas `(letra, nome, papel, cabeçalho_esperado, opções)`.

Papéis: `rotulo`, `livre`, `categoria(vocabulário)`, `booleano`, `municipio`, `numero_convenio`, `codigo`, `data`, `numero`, `inteiro`. Opções: `identificacao` (herdada nas continuações) e `repete(letra)` (coluna descartada e comparada com a original).

As tabelas SQLAlchemy (Core `Table` em `Base.metadata`) são geradas a partir do layout. A migration `0002` é uma cópia congelada (autogenerate revisado) e não importa o layout.
- *Alternativa*: classes ORM escritas à mão (~200 colunas). Rejeitada: duplicaria o mapeamento, e as cópias sairiam de sincronia.

### 3. Tabelas e colunas
Tabelas: `planilha_convenios_geral` (342), `planilha_convenios_transferidos` (89), `planilha_convenios_vigentes` (31), `planilha_prestacao_contas`, `planilha_realinhado_sem_execucao`, `planilha_nao_realinhado_expirado`, `planilha_tomada_contas` e `planilha_acompanhamento_especial`.

Colunas de controle: `id` (bigint), `importacao_id` (FK → `planilha_importacao`), `linha` (int) e `linha_principal` (bool). Só a Tomada de Contas tem `bloco` (smallint), e só a 342 e a ACOMPANHAMENTO têm `colunas_corrigidas` (bool).

Nomes iguais em todas as abas para o mesmo dado: `municipio`, `numero_convenio`, `codigo_seobras`, `codigo_seiop`, `processo_celebracao`, `objeto`, `realinhado`, `vigencia_final`, `situacao_vigencia`, `item`. Os demais saem do cabeçalho em snake_case. Repetições se resolvem pelo grupo do cabeçalho com `_inicial`/`_realinhado` (ex.: `repasse_inicial`, `repasse_realinhado`). Colunas sem cabeçalho:
- A da 342/ACOMPANHAMENTO → `chave_planilha` (rótulo `MUNICIPIO_NNN_AAAA`);
- K da 31 → `andamento` (categoria);
- AH da 89 → `coluna_ah` (livre);
- O da Prest de Contas → `coluna_o` (numero).

Colunas descartadas: na 31, M e W (`repete D`) e N (`repete E`). A L da 31 vira `item_homologacao` (inteiro), sem comparação com A, porque é outra numeração.

Papéis por tipo de dado:
- `municipio`: Município/MUNICÍPIOS de todas as abas.
- `numero_convenio`: Nº do Convênio Original, Nº CONVÊNIO e CONVÊNIO.
- `codigo`: SIAFEM/SIAFE/SEOBRAS/SEIOP.
- `categoria`: Status Convênio e Situação Vigência (342/ACOMPANHAMENTO); Situação Vigência e Status (89); Situação e andamento (31); Situação (Prest de Contas, Realinhado, Não Realinhado).
- `booleano`: Realinhado.
- `livre`: objeto, observação, parecer, status da Tomada de Contas, status da prestação, processos, NPs.
- `rotulo`: CNPJ, Processo Celebração e Processo de Pagamento quando há um processo só por célula.
- `data`, `numero` e `inteiro` como na spec. Item e Parcela são `inteiro`.

### 4. Regras de normalização (funções puras, `(valor, aviso|None)`)
- **Ausência**: `None`, texto vazio ou só espaços, texto só de pontuação (`-`, `.`, `;`) e erros do Excel (`#REF!`, `#N/A`, `#VALUE!`, `#DIV/0!`, `#NAME?`, `#NULL!`, `#NUM!`) → `NULL` sem aviso.
- **`rotulo`**: espaço em branco de qualquer tipo (inclusive `\n`) colapsado num espaço, mais strip. Número vira `str` (`format(v, ".15g")`), data vira `AAAA-MM-DD`.
- **`livre`**: cada linha com strip e espaços colapsados; linhas vazias removidas; junção com `\n`.
- **Chave de comparação** (categorias, municípios, booleano): rótulo limpo, casefold, sem acentos (NFKD) e só caracteres alfanuméricos. Assim `"Sâo Fidélis"`, `"SÃO FIDÉLIS"` e `"São Fidélis"` têm a mesma chave, e `"RioClaro"` e `"Rio Claro"` também.
- **`categoria`**: chave → valor canônico do vocabulário. Fora do vocabulário, grava o rótulo limpo + aviso `categoria_desconhecida`. Os vocabulários (`app/planilha/dominios.py`) são tirados da revisão atual, e o canônico é a grafia predominante na planilha, sem espaços sobrando:
  - Status Convênio: Vigente, Não Vigente, Concluído, Concluído/Aprovado, Expirado, Expirado/Cancelado, Expirado/Concluído, Tomada de Contas.
  - Situação Vigência: Vigente, Expirado, Em andamento.
  - Status (89): os 16 textos distintos observados (ex.: "Em Andamento", que também cobre "Em andamento").
  - Situação (31): Vigente, Vigente / Realinhado, Vigente / Não Realinhado.
  - Andamento (31): Em Andamento, Não Realinhado, Aguardando repasse para reinício da Obra, Concluído.
  - Situação (Prest de Contas): Não Repassado, Repassado, 100% Executado, Não Realinhado.
  - Situação (Realinhado): Realinhado sem Execução, Realinhado/Concluído Com Recurso Próprio, Realinhado e Cancelado.
  - Situação (Não Realinhado): Não Realinhado.

  `100%Executado` e `100% Executado` têm a mesma chave. Textos livres que aparecem em colunas de situação (ex.: "Verificar proc.SEI-…") geram aviso. São poucos, e o aviso é o sinal para a equipe.
- **`booleano`**: chave `sim` → `true`, `nao` → `false`; outro valor → `NULL` + aviso.
- **`municipio`**: `dominios.MUNICIPIOS_RJ` (92 nomes oficiais) indexado pela chave, mais `ALIASES` para as abreviações observadas (`saojvaledoriopreto`, `saojdovdoriopreto`, `saojosedovaleriopreto` → São José do Vale do Rio Preto; `saofdoitabapoana` → São Francisco de Itabapoana; `comendadorlgasparian` → Comendador Levy Gasparian; `engenheiropdefrontin` → Engenheiro Paulo de Frontin). Não reconhecido → rótulo limpo + aviso `municipio_desconhecido`.
- **`numero_convenio`**: remove espaços e aplica `^(\d{1,3})(?:[-/]([A-Za-z]))?/(\d{2}|\d{4})$`. O resultado é `f"{n:03d}{'-'+L.upper() if L else ''}/{ano}"`, com ano de 2 dígitos virando `2000+aa`. Fora do padrão → `NULL` + aviso `numero_convenio_invalido`.
- **`codigo`**: `int` → `str(v).zfill(6)`; texto sem apóstrofo inicial e sem espaços, que precisa casar `^\d{1,6}$`, também recebe `zfill(6)`. Outro valor → `NULL` + aviso `codigo_invalido`.
- **`data`/`numero`/`inteiro`**: data → `date`; número → `Decimal(format(v, ".15g"))`, os 15 dígitos significativos que o Excel guarda, o que remove resíduos como `991879.4210000001`; texto numérico simples (`"3"`, `"10.5"`) e no formato brasileiro (`"1.234,56"`, `"31,5"`: vírgula decimal, ponto de milhar opcional) é aceito, e só o texto com vírgula é lido como pt-BR; inteiro exige valor integral. Outro valor → `NULL` + aviso `valor_invalido`.
- **Fórmulas sem valor calculado**: a extração carrega o arquivo também com `data_only=False`. Fórmula com cache vazio → aviso `formula_sem_valor`.

### 5. Regras por aba
- **Continuação por Item** (89, 31, Prest de Contas): a linha com `item` nulo é de continuação. Ela copia da última linha principal as colunas marcadas `identificacao` (item, processo(s), município, nº do convênio, códigos, CNPJ, objeto, realinhado, vigência, situação/status) e recebe `linha_principal = false`. Valores, quantidades e percentuais não são copiados: ficam só na linha principal (mescla) ou com o valor próprio da continuação (faixa de parcelas). Assim, `SUM` sobre a tabela não conta duas vezes. Continuação antes de qualquer linha principal → erro de layout.
- **Município mesclado** (Tomada de Contas): célula de município não superior de mescla vertical recebe o município da célula superior. Toda linha é principal.
- **Deslocamento H–K** (342/ACOMPANHAMENTO): se o valor cru de H é data, os valores crus de H, I e J vão para `vigencia_final`, `situacao_vigencia` e `prestacao_contas`, e `realinhado` fica nulo. Valor em K numa linha deslocada → aviso `deslocamento_inesperado`, com K descartado. A linha recebe `colunas_corrigidas = true`. Linha não deslocada segue os cabeçalhos. A regra roda antes das conversões por papel, então a data deslocada é tipada como `data`.
- **Colunas repetidas** (31): calcula o valor tratado de M, N e W e compara com D, E e D. Se ambos não forem nulos e diferirem → aviso `repeticao_divergente`. As colunas descartadas não vão para a tabela.

### 6. Avisos
Formato `{aba, celula, coluna, motivo, valor}`, em que `valor` é o original como texto. Motivos: `valor_invalido`, `categoria_desconhecida`, `municipio_desconhecido`, `numero_convenio_invalido`, `codigo_invalido`, `repeticao_divergente`, `deslocamento_inesperado`, `formula_sem_valor`. A orquestração junta os avisos de todas as abas.

### 7. Delimitação das linhas e identificação das abas
Regras de fim: `primeira_vazia`, `marcador` (coluna A começa com o texto, ex.: `"Total Geral"`), `coluna_vazia` (ex.: OBJETO na Tomada de Contas) e `ultima_nao_vazia`. Linhas totalmente vazias dentro da faixa são puladas. Não encontrar o `marcador`/`coluna_vazia` é erro. O segundo bloco da Tomada de Contas declara título, cabeçalho (validado) e fim próprios. Célula com valor fora das colunas do layout na faixa de dados é erro.

Abas: nomes normalizados (`strip` + espaços colapsados) comparados exatamente com os 8 do layout e com a lista de ignoradas (`Planilha2`, que pode faltar). Falta de aba importada ou nome desconhecido gera erro listando ambos.
- *Alternativa*: casar por regex (`\d+ Convênios`). Rejeitada: "342 Convênios" e "89 Convênios" casariam com o mesmo padrão.

### 8. Orquestração (`app/etl/planilha.py`)
1. Verifica se o arquivo existe (sem lê-lo), antes do lock e sem registro.
2. `reservar()`: `pg_try_advisory_lock` com chave própria (diferente da `LOCK_ID` do SIAFE). Só com o lock em mãos lê o arquivo para o SHA-256, de modo que uma execução concorrente é recusada sem ler nada. Marca órfãos `em_andamento` como `falha` e cria o registro.
3. Extração das 8 abas → transformação, tudo em memória.
4. Numa transação: `DELETE` nas 8 tabelas + bulk `INSERT` por tabela.
5. Finaliza o registro em transação própria; libera o lock no `finally`.

O helper de lock/registro não é extraído de `app/etl/siafe.py` nesta mudança, para não mexer numa carga que funciona; extrai-se quando surgir uma terceira.

### 9. Registro: tabela `planilha_importacao`
Colunas:
- `id`, `inicio`, `fim`, `status` (`em_andamento` | `sucesso` | `falha`);
- `arquivo` (só o nome, sem o caminho);
- `sha256`;
- `linhas_por_aba` (JSONB);
- `total_avisos` (int);
- `avisos_por_motivo` (JSONB);
- `avisos` (JSONB, primeiros 1000);
- `erro` (text, até 2000 caracteres).
- *Alternativa*: reusar `etl_execucao`. Rejeitada: obrigaria a mudar `GET /etl/siafe/status` e a spec `siafe-ingestion`.

### 10. CLI
`uv run python -m app.etl.planilha <arquivo.xlsx>` (argparse). Códigos de saída: 0 sucesso, 1 falha (inclusive arquivo inválido) e 2 lock ocupado. A saída mostra linhas por aba, avisos por motivo e os primeiros 20 avisos.

### 11. Testes
- Transformação: testes unitários com listas de `LinhaCrua` montadas em código, um por regra da spec, sem xlsx.
- Extração: um gerador `tests/planilha_sintetica.py` monta com openpyxl um workbook com as 9 abas (inclusive uma Planilha2 qualquer), com cabeçalhos do layout, linhas fictícias, mesclas, linhas vazias, totais, quadro-resumo, 2º bloco da Tomada de Contas, linhas deslocadas e valores sujos.
- Integração (Postgres via `TEST_DATABASE_URL`): overwrite, falha sem alteração, lock e registro.
- O guard do `conftest.py` e o `TRUNCATE` incluem as tabelas `planilha_*`.

## Risks / Trade-offs

- [Sem camada crua, uma regra de normalização errada grava dado errado e o original não fica no banco] → regras conservadoras (só vocabulários e aliases explícitos), avisos com o original para tudo o que não casa, hash do arquivo no registro e reprocessamento simples: corrige a regra e roda de novo, já que é overwrite. A verificação final confere amostras contra a planilha.
- [Vocabulários e aliases ficam defasados quando a equipe digitar valores novos] → o valor entra limpo e gera aviso; a CLI mostra avisos por motivo para a manutenção ser rápida.
- [Cabeçalhos do layout transcritos com erro] → os testes geram cabeçalhos a partir do layout e não pegariam isso. Mitigação: a verificação com a planilha real confere a contagem por aba (revisão 11/08/2026: 342 → 342; 89 → 97, dos quais 89 principais; 31 → 34; Prest de Contas → 335; Realinhado → 5; Não Realinhado → 11; Tomada de Contas → 32 (26 + 6); ACOMPANHAMENTO → 55).
- [Regra de deslocamento confunde uma linha legítima com data em Realinhado] → Realinhado legítimo só tem Sim/Não, então uma data ali é sempre deslocamento. `colunas_corrigidas` deixa as linhas auditáveis.
- [Nº do convênio pode não ser único entre abas ou municípios] → a mudança não cria unicidade nem chave estrangeira; a integração futura decide. A verificação final mede duplicidades.
- [Cada revisão nova pode quebrar a validação de layout] → intencional; a mensagem aponta aba e célula.
- [Cores e comentários se perdem] → fora do escopo.

## Migration Plan

1. `uv run alembic upgrade head` aplica a `0002` (só cria tabelas).
2. Primeira carga: `uv run python -m app.etl.planilha "../data/<planilha>.xlsx"`.
3. Rollback: `uv run alembic downgrade 0001` remove as 9 tabelas. A carga SIAFE não é afetada.
