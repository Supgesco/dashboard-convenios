# Design

## Context

Estado atual, com o que foi observado nos dados carregados localmente:

- **`siafe_flexvision`**: uma linha por (ano, mês, conta corrente, conta contábil), de 2023-01 até o mês corrente, substituída inteira a cada carga.
  - Só há uma UG (530100, SEIOP), e `credor` vem sempre nulo.
  - `conta_corrente` tem sempre 6 dígitos e é o código do convênio: 352 contas distintas.
  - Cada linha é um saldo de estoque, por isso nada se soma entre meses.
  - A chave (ano, mês, conta corrente, conta contábil) é única. Cada linha só tem valor na coluna da sua conta contábil: 812210101 → a pagar, 102 → a comprovar, 103 → a aprovar, 104 → aprovados. Há linhas com saldo zero.
  - A consulta FlexVision traz saldos mensais por conta contábil, não lançamentos individuais (empenho, pagamento, data).
- **Tabelas `planilha_*`**: uma por aba, com só a última importação bem-sucedida (overwrite atômico). Não é preciso filtrar por `importacao_id`.
  - Todas têm `municipio`, `numero_convenio` (normalizado `NNN[-L]/AAAA`) e `codigo_seobras`.
  - Todas, menos a Tomada de Contas, têm `codigo_seiop`. Os códigos já vêm com 6 dígitos.
  - A 89 tem linhas de continuação (`linha_principal = false`), que herdam a identificação. A Prestação de Contas tem várias linhas por convênio, uma por parcela.
- **Cruzamento observado**:
  - 287 das 352 contas acham par em alguma aba.
  - As 65 restantes são códigos SEOBRAS antigos de convênios da 342 que estão sem código.
  - 31 ⊂ 89 ⊂ 342 pela chave `numero_convenio + municipio`, que é única e nunca nula na 342 atual.
  - Os códigos SEIOP só existem para convênios da 89.
  - Em 25 convênios os dois códigos têm saldo no mesmo mês, com valores complementares, por isso a soma.
- **Restrições**:
  - A consulta do SIAFE não pode ser ampliada (sem número do convênio ou CNPJ).
  - A planilha é a fonte da correção dos códigos.
  - Dados reais não entram no repositório.

## Goals / Non-Goals

**Goals:**
- Regras do cruzamento num lugar só, em SQL declarativo, consultáveis por qualquer leitor (API futura, `psql`, BI).
- Cada regra da spec corresponde a uma view ou a uma coluna verificável por teste com dados sintéticos.
- Custo zero de sincronização: nenhuma carga precisa saber que o cruzamento existe.

**Non-Goals:**
- Desempenho além do volume atual (cerca de 29 mil linhas no SIAFE e algumas centenas na planilha). Não há view materializada nem índice novo por ora.
- Modelos ORM para as views. Quem consumir lê por SQL/Core quando a camada de leitura for desenhada.
- Lançamentos individuais do SIAFE: a consulta não os traz e não pode ser ampliada. O nível mais fino é o registro mensal por conta contábil.
- Coluna `valor` única derivada da conta contábil: os 4 saldos são expostos como vieram do SIAFE.

## Decisions

### 1. Views comuns no Postgres, criadas por migration
Escolhemos views (calculadas na leitura) porque as duas cargas são independentes, cada uma com seu lock. Uma tabela derivada ficaria defasada sempre que só uma delas rodasse.

Alternativas descartadas:
- **Tabela calculada ao fim de cada carga**: exige coordenar os dois advisory locks e acrescenta um terceiro modo de falha.
- **View materializada**: exige `REFRESH` nas duas cargas, sem ganho no volume atual.
- **Cálculo em Python**: as regras ficariam fora do banco e cada leitor teria de reimplementar.

Se o volume crescer, a troca por view materializada mantém o mesmo contrato de colunas.

### 2. Conjunto de views (camadas)

```
 planilha_* (8) --> v_cruzamento_codigo_origem   uma linha por (aba, linha, tipo, código) não nulo
                          |
 planilha_convenios_geral --> v_convenio          chave, linha, status, fase, codigo_seobras, codigo_seiop
                          |                        (+ aba de origem de cada código)
                          v
                    v_convenio_codigo             convênio x código distinto, com tipos (text[])
                          |
 siafe_flexvision ------->+--> v_convenio_registro       convênio x linha do SIAFE (sem agregação)
                          |          |
                          |          v
                          |    v_convenio_saldo_codigo   convênio x código x (ano, mês), 4 saldos
                          |          |
                          |          v
                          |    v_convenio_saldo          convênio x (ano, mês), soma dos códigos
                          |
                          +--> v_cruzamento_falha        motivo + contexto + saldos do último mês
```

- **`v_cruzamento_linha`** (camada de apoio): `UNION ALL` das 8 tabelas, uma linha por linha da planilha, com `aba`, `prioridade`, `linha`, `linha_principal`, chave e os dois códigos (a Tomada de Contas vem com SEIOP nulo). Existe porque `linha_sem_convenio` precisa também das linhas sem código, que o unpivot abaixo descarta.
- **`v_cruzamento_codigo_origem`**: unpivot de `v_cruzamento_linha`, com:
  - `aba`, `prioridade`, `linha`, `numero_convenio`, `municipio`;
  - `tipo` (`SEOBRAS`/`SEIOP`), vindo de unpivot das duas colunas;
  - `codigo`.

  As prioridades são 31 = 1, 89 = 2, 342 = 3, e as auxiliares 4 a 8 na ordem do layout (Prestação, Realinhado sem Execução, Não Realinhado Expirado, Tomada de Contas, Acompanhamento Especial).
- **`v_convenio`**:
  - Base: as linhas da 342 com chave completa, `DISTINCT ON (numero_convenio, municipio) ORDER BY linha`, de modo que a primeira linha vence.
  - A fase vem de `EXISTS` na 31 e na 89.
  - Cada código é o primeiro candidato ligado pela chave, `ORDER BY prioridade, linha`, por tipo.
  - Como as auxiliares têm prioridade maior que a 342, a spec "auxiliar só quando o funil não tem" sai da mesma ordenação, sem caso especial.
- **`v_convenio_codigo`**: o unpivot dos dois códigos do convênio, agrupado por código, com `array_agg(tipo)`. Assim um código repetido nos dois tipos conta uma vez.
- **`v_convenio_registro`**: junção de `v_convenio_codigo` com `siafe_flexvision` por `conta_corrente = codigo`, uma linha por linha do SIAFE. Expõe:
  - a chave do convênio, `ano`, `mes`, `conta_corrente` e `tipos`;
  - `conta_contabil` e `conta_contabil_nome`;
  - os 4 saldos.

  Linhas zeradas entram. Como `v_convenio_codigo` já é distinta por código, um código nos dois tipos não duplica registros.
- **`v_convenio_saldo_codigo`**: `SUM` das 4 colunas de `v_convenio_registro`, agrupado por (convênio, código, ano, mês).
  - Derivar da view de registros garante que soma e detalhe nunca divergem.
  - A soma junta as linhas de contas contábeis diferentes do mesmo mês. Isso é agregação dentro da foto, não entre meses.
- **`v_convenio_saldo`**: soma de `v_convenio_saldo_codigo` por (convênio, ano, mês).
- **`v_cruzamento_falha`**: `UNION ALL` com colunas comuns:
  - `motivo`, `numero_convenio`, `municipio`, `aba`, `linha`, `tipo_codigo`, `codigo`, `detalhe`;
  - `ano`, `mes` e os 4 saldos, preenchidos quando o motivo envolve uma conta do SIAFE.

  Motivos e como cada um é calculado:

| Motivo | Como é calculado |
|---|---|
| `conta_siafe_sem_convenio` | contas distintas do SIAFE fora de `v_convenio_codigo`, com saldos do último mês via `LEFT JOIN` |
| `convenio_sem_codigo` | convênio com os dois códigos nulos |
| `codigo_fora_do_siafe` | código de `v_convenio_codigo` sem nenhuma linha no SIAFE |
| `codigo_divergente` | candidato ligado a um convênio cujo código difere do escolhido para o mesmo tipo, distinto por (convênio, tipo, aba, código) |
| `codigo_em_mais_de_um_convenio` | código com mais de um convênio, com as chaves em `detalhe` |
| `linha_sem_convenio` | linha principal de aba que não é da 342 e cuja chave não está em `v_convenio`, com os códigos em `detalhe`; a 342 em si nunca cai aqui, e as linhas de continuação (`linha_principal = false`) ficam de fora porque herdam chave e códigos da principal |
| `chave_ausente_342` | linha da 342 sem número ou sem município |
| `chave_repetida_342` | linha da 342 com chave repetida que não é a primeira |

  Os motivos usam *snake_case* para servirem de filtro estável. Os rótulos legíveis ficam para o front-end.

O último mês carregado é `max(ano * 100 + mes)` de `siafe_flexvision`. Com a tabela vazia, as colunas de saldo vêm nulas.

O identificador exposto do convênio é a chave (`numero_convenio`, `municipio`). A `linha` da 342 acompanha só como referência, porque muda entre revisões da planilha e o `id` muda a cada importação.

### 3. Ligação apenas por igualdade exata da chave e do código
A ligação usa a chave normalizada que o ETL já grava, por igualdade exata. Não há casamento aproximado: a normalização determinística já foi feita na carga (município oficial e número `NNN/AAAA`). Quando a chave não casa, isso aparece como `linha_sem_convenio`, e a correção é feita na planilha ou em `dominios.py`.

### 4. SQL congelado na migration `0003`
Assim como a `0002`, a migration traz o SQL literal das views (`op.execute`) e não importa o layout. O `downgrade` faz `DROP VIEW` na ordem inversa das dependências.

As views ficam fora de `Base.metadata`. O autogenerate do Alembic não reflete views, então `alembic check` continua limpo.

Uma migration futura que alterar uma tabela `planilha_*` usada pelas views terá de recriá-las. O Postgres recusa o `ALTER`/`DROP` com dependências, então o erro aparece na hora.

### 5. Testes de integração com dados sintéticos
O arquivo `tests/test_cruzamento.py` usa o `db_engine` existente e funciona assim:
- insere um `etl_execucao` e um `planilha_importacao` para satisfazer as FKs;
- insere linhas mínimas nas `planilha_*` (via `TABELAS_PLANILHA`) e em `siafe_flexvision`;
- consulta as views.

Cada cenário da spec vira um teste. Os códigos, números e municípios são fictícios. O `TRUNCATE` do `conftest` já cobre as tabelas, e as views não guardam estado.

## Risks / Trade-offs

- **[Risco]** Um código em dois convênios faz a conta ser somada duas vezes nos totais gerais. → Fica explícito em `codigo_em_mais_de_um_convenio`. O consumidor de totais gerais deve somar a partir das contas distintas do SIAFE, não dos convênios. Isso fica registrado para a camada de leitura.
- **[Risco]** Uma revisão da planilha muda a chave de um convênio, por exemplo ao corrigir um número, e a 89 e a 31 deixam de se ligar a ele. → Isso aparece como `linha_sem_convenio` logo após a importação.
- **[Trade-off]** O código descartado por divergência não é atribuído a ninguém, então a conta aparece também como `conta_siafe_sem_convenio`. Isso é intencional: a falha fica visível em duas listas até a planilha ser corrigida.
- **[Trade-off]** Calcular na leitura repete a junção a cada consulta. No volume atual o custo é desprezível, e há saída para view materializada sem mudar o contrato (Decisão 1).
- **[Premissa]** Na exploração, a regra das abas auxiliares (só completam, nunca sobrescrevem) foi proposta e não contestada antes do `/opsx:propose`. Se a equipe preferir outra regra, só muda a coluna `prioridade` de `v_cruzamento_codigo_origem`.

## Migration Plan

1. `uv run alembic upgrade head` cria as views. Nenhum dado é tocado, e as views funcionam com as tabelas vazias ou cheias.
2. Rollback: `uv run alembic downgrade 0002` remove só as views.

## Open Questions

- **Ordem entre as abas auxiliares** quando duas delas trazem códigos diferentes e o funil não tem nenhum. A ordem do layout foi adotada provisoriamente. O caso é raro e aparece como `codigo_divergente`, então a ordem pode ser revista sem mudar a spec.
- **Migração SEOBRAS → SEIOP no SIAFE**: confirmar com a área financeira que a troca de código não moveu saldos entre as contas. Se tiver movido, a soma por convênio continua certa, mas a quebra por código no detalhe precisa de nota explicativa.
