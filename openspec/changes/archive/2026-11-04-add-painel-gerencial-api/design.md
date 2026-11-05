# Design

## Context

Motivação e escopo: ver proposal.md.

O que já existe e molda a abordagem:
- A `0003` define o cruzamento como views calculadas na leitura:
  - `v_convenio` tem a chave (`numero_convenio`, `municipio`), a linha da 342, `status`, `fase` (`vigente`, `realinhado` ou `historico`) e os códigos;
  - `v_convenio_codigo` tem um código distinto por convênio;
  - `v_convenio_saldo` tem o saldo por convênio e mês.

  Um código que pertence a dois convênios aparece em ambos, então somar `v_convenio_saldo` entre convênios conta esse código duas vezes.
- As fases são exclusivas, mas as abas são aninhadas: todo convênio da 31 também está na 89, e todo convênio da 89 também está na 342. Por isso, `fase = 'vigente'` corresponde à 31 e `fase IN ('vigente', 'realinhado')` corresponde à 89.
- Nas abas 31 e 89, as linhas de continuação (`linha_principal = false`) herdam a chave e às vezes trazem valores próprios, como um repasse ou uma execução a mais.
- O SIAFE tem uma única UG. Cada (ano, mês) é uma foto do estoque, e a carga vai de 2023-01 até o mês corrente em America/Sao_Paulo.
- A única API são os endpoints do ETL (`app/routers/etl.py`), que obtêm o engine por `Depends(get_engine)`. Os testes trocam essa dependência por `app.dependency_overrides`.

## Goals / Non-Goals

**Goals:**
- Pôr todas as regras de soma no SQL (views novas e consultas parametrizadas), para que o router só valide a entrada e monte o JSON.
- Garantir que nenhum total da tela conte o mesmo código SIAFE duas vezes.
- Manter as views do painel independentes das cargas, como as da `0003`.

**Non-Goals:**
- Busca textual nas listas.
- Paginação da série mensal, que alimenta um gráfico e tem cerca de 12 pontos por ano.
- Cache e views materializadas.
- Mudar alguma view da `0003`.

## Decisions

### 1. O recorte é definido sobre `v_convenio`

A view `v_recorte_convenio` tem uma linha por (recorte, convênio):

| recorte | convênios |
|---|---|
| `31` | `fase = 'vigente'` |
| `89` | `fase IN ('vigente', 'realinhado')` |
| `342` | todos |

As colunas são `recorte`, `numero_convenio`, `municipio`, `status`, `situacao_vigencia` (da linha da 342 que deu origem ao convênio) e `fase`.

Linhas da 31 ou da 89 cuja chave não existe na 342 ficam fora do painel. Elas não têm código pelo cruzamento e já aparecem em `v_cruzamento_falha` como `linha_sem_convenio`.

**Alternativa considerada:** definir o recorte direto pelas linhas da aba. Rejeitada porque o convênio da 31 sem par na 342 teria valores contratuais e nenhum saldo SIAFE, e a contagem de convênios do recorte deixaria de bater entre os blocos da tela.

### 2. Valores contratuais consolidados por convênio na view `v_valor_contratual`

A view tem uma linha por (recorte, convênio), só para os recortes `31` e `89`, cada um lido da sua aba (`planilha_convenios_vigentes` e `planilha_convenios_transferidos`). Ela soma todas as linhas da chave, principais e de continuação, e se limita às chaves de `v_recorte_convenio`.

| coluna | 31 | 89 |
|---|---|---|
| `base` | `'realinhado'` se alguma linha tem `valor_total_realinhado`, senão `'inicial'` | idem |
| `valor_total` | `sum(valor_total_<base>)` | idem |
| `repasse_estado` | `sum(repasse_<base>)` | idem |
| `contrapartida` | `sum(contrapartida_<base>)` | idem |
| `investido_estado` | `sum(total_investido)` | `sum(total_investido_estado)` |
| `a_repassar` | `sum(valor_a_repassar)` | `sum(valor_a_repassar)` |

- A escolha entre realinhado e inicial é feita uma vez por convênio, e não linha a linha. Assim, valor total, repasse e contrapartida sempre vêm do mesmo grupo de colunas. A regra segue o valor preenchido, e não a flag `realinhado`, porque os dois discordam em 8 casos na aba 89.
- O `sum` ignora nulos e dá nulo quando todas as linhas são nulas. Um convênio sem nenhum valor (como os 5 do Realinhado sem Execução) fica com valores nulos e não com zero.
- Nenhum percentual entra na view. O percentual de execução é `sum(investido_estado) / nullif(sum(repasse_estado), 0)`, calculado na consulta sobre o conjunto pedido: convênio, município ou recorte inteiro.
- "A repassar" é mostrado como a planilha registra, sem recálculo, porque a identidade repasse − executado fecha só em cerca de 55% dos convênios.

**Alternativa considerada:** `coalesce(realinhado, inicial)` linha a linha. Rejeitada porque uma linha de continuação com só um valor inicial misturaria os dois grupos no mesmo convênio.

### 3. Saldos SIAFE sem dupla contagem

Todo bloco de saldo segue o mesmo padrão. Primeiro forma o conjunto de convênios (recorte ∩ municípios), depois o conjunto **distinto** de códigos desses convênios (`v_convenio_codigo`), e por fim soma `siafe_flexvision` filtrado por esses códigos e pelo mês.

```sql
WITH conv AS (SELECT numero_convenio, municipio FROM v_recorte_convenio
              WHERE recorte = :recorte AND (:sem_filtro OR municipio = ANY(:municipios))),
     cod  AS (SELECT DISTINCT cc.codigo FROM v_convenio_codigo cc JOIN conv USING (numero_convenio, municipio))
SELECT sum(s.convenios_a_pagar), ... FROM siafe_flexvision s
JOIN cod ON cod.codigo = s.conta_corrente
WHERE s.ano = :ano AND s.mes = :mes
```

- **Resumo e série:** um conjunto de códigos para o filtro inteiro, então um código compartilhado conta uma vez.
- **Ranking por município:** um conjunto por município. Um código compartilhado entre convênios de municípios diferentes entra nos dois, e a linha do município traz `codigo_compartilhado = true`. A soma das linhas do ranking pode passar do total do resumo, e a flag explica a diferença.
- **Lista de convênios:** usa `v_convenio_saldo` (o saldo do convênio é a soma dos seus códigos, como na `0003`) com a mesma flag por convênio.
- **Cobertura:** `vinculado` é o total do recorte sem filtro de município, e `total_siafe` é a soma de todas as contas do mês. Com qualquer município selecionado, o campo é `null`, porque o total do SIAFE não tem município.

**Alternativa considerada:** somar `v_convenio_saldo`. Rejeitada por causa da dupla contagem acima.

### 4. Mês de referência e datas das cargas

- `ano` e `mes` são opcionais e vêm juntos (um sem o outro gera 422). Sem eles, a referência é o mês corrente em America/Sao_Paulo, o mesmo fuso da carga. O "hoje" vem de uma dependência para os testes poderem fixá-lo.
- Se o SIAFE não tem nenhuma linha para o mês de referência, o bloco `siafe` vem `null`, e `referencia.ultimo_mes_disponivel` informa o mês mais recente carregado para o front oferecer. O mês nunca é trocado em silêncio.
- `siafe.mes_anterior` traz os 4 saldos do mês anterior, com o mesmo recorte e filtro, ou `null` sem dados. A variação é calculada no front.
- `referencia.posicao_siafe_em` é o `fim` da última `etl_execucao` com `status = 'sucesso'`. `referencia.planilha_importada_em` e `referencia.arquivo` vêm da última `planilha_importacao` com sucesso. Cada campo é `null` se a carga correspondente nunca teve sucesso.

### 5. Parâmetros e validação

- `recorte`: `Literal["31", "89", "342"]`, com padrão `"31"` (a carteira em andamento é a visão de abertura).
- `municipio`: `list[str]` repetível (`?municipio=Paraty&municipio=Resende`). Cada valor é casado por `chave()` contra `MUNICIPIO_POR_CHAVE` de `app/planilha/dominios.py` e normalizado para o nome canônico, a mesma regra da carga da planilha (sem casamento aproximado). Valores inválidos geram 422, com `detail` listando os não reconhecidos. Repetições são ignoradas.
- Um município válido sem convênios no recorte não é erro e dá totais vazios.

### 6. Formas de resposta

- Valores monetários vão como número JSON (float), com os somatórios arredondados a 2 casas no SQL. O Pydantic v2 serializaria `Decimal` como string, e o front teria de converter tudo. Os totais desta carteira ficam muito abaixo de 2⁵³ centavos, então não há perda de centavos.
- Um saldo ou valor sem dados é `null`, nunca zero.
- O ranking e a lista são paginados e ordenados no servidor (Decisão 8). O front não reordena, porque só teria a página em mãos.
- As contagens de situação do recorte 342 são listas `[{"valor": ..., "convenios": n}]` por `status` e por `situacao_vigencia`, com `valor: null` para o não informado.

### 7. Organização do código

- `app/painel/consultas.py` tem funções puras sobre uma `Connection` com SQL literal (`text()`) e parâmetros nomeados, sem montar SQL com strings.
- `app/routers/painel.py` tem o router `/painel`, os modelos Pydantic de resposta e as dependências `get_engine` (a mesma do router de ETL, reaproveitada) e `get_hoje`.
- A migration `0004` segue o padrão da `0003`: lista `VIEWS` de (nome, SQL), `CREATE VIEW` em ordem e `DROP VIEW` na ordem inversa.

### 8. Paginação e ordenação do ranking e da lista

- **Parâmetros:** `pagina` (≥ 1, padrão 1), `tamanho` (1 a 100, padrão 20) e `ordem` (opcional). Fora dos limites, a resposta é 422, pela validação do FastAPI.
- **No SQL:** `LIMIT :tamanho OFFSET (:pagina - 1) * :tamanho` sobre a consulta já agregada, e `count(*) OVER ()` para o `total` na mesma ida ao banco. A página além do fim não traz linhas, e então o `total` vem de um `count` separado, para não voltar zero.
- **`ordem`:** cada endpoint tem uma whitelist fixa que mapeia o nome do campo para a sua coluna:
  - ranking: `municipio`, `convenios`, os 4 saldos e os valores contratuais com `execucao_pct`;
  - lista: `numero_convenio`, `municipio`, `status`, `fase`, os 4 saldos e os valores contratuais com `execucao_pct`.

  O `ORDER BY` é montado só a partir dessa whitelist, nunca com o texto recebido, e um nome fora dela gera 422. A ordem é sempre `<coluna> ASC|DESC NULLS LAST`, com desempate por `municipio, numero_convenio` (só `municipio` no ranking), o que mantém as páginas estáveis.
- **Envelope:** `{recorte, ano, mes, municipios, pagina, tamanho, total, itens}`. Os campos atuais continuam, e são acrescentados `pagina`, `tamanho` e `total`.
- **A série não é paginada:** é um gráfico, e paginá-la obrigaria o front a juntar páginas.

**Alternativa considerada:** buscar tudo e paginar no Python. Rejeitada porque o `total` e a ordenação ficariam fora do SQL, contra a regra de deixar a aritmética no banco, e porque ordenar sobre a página é justamente o que a paginação quebra.

**Alternativa considerada:** paginação por cursor (keyset). Rejeitada porque as listas têm no máximo 342 itens e a tela precisa pular para uma página qualquer.

## Risks / Trade-offs

- [A soma de uma página do ranking não é o total do recorte] → o total continua no `/painel/resumo`, e o `total` da paginação conta itens, não reais.
- [`ORDER BY` dinâmico abre espaço para injeção de SQL] → a coluna vem só da whitelist, e o valor recebido nunca entra no texto do SQL. Um teste cobre o 422 para um campo fora da lista.
- [No começo do mês, o SIAFE pode ainda não ter dados do mês corrente, e a tela de abertura ficaria sem saldos] → o bloco `siafe` vem `null` com `ultimo_mes_disponivel`, e o front mostra o aviso e oferece o mês. Não há troca automática que esconda a defasagem.
- [Uma alteração futura de `planilha_*` agora também esbarra nas views da `0004`] → a regra do `CLAUDE.md` sobre recriar views passa a citar a `0004`, e a ordem de `DROP`/`CREATE` fica explícita na lista `VIEWS`.
- [Somar as linhas de continuação pode contar duas vezes um valor que a planilha repete numa linha de continuação] → pela regra da carga, linhas de continuação não herdam valores, então um valor preenchido nelas é próprio da linha. Um teste fixa esse comportamento.
- [Float no JSON] → o arredondamento é feito no SQL, e o front só formata. Se um dia surgir uma exportação contábil, ela pode usar string.
- [A cobertura do recorte 31 é pequena por definição, porque mede só a parte do SIAFE ligada aos vigentes] → o rótulo da tela deve dizer "do saldo SIAFE no mês, X% está ligado a este recorte". A spec define o cálculo, e o texto fica com o front.

## Migration Plan

- `uv run alembic upgrade head` aplica a `0004`, que só cria views, rápida e sem bloqueio de tabela. O rollback é `uv run alembic downgrade 0003`, que remove só as views do painel.
- Os endpoints novos não alteram nada nos existentes, então o deploy não tem ordem especial além de migrar antes de subir a API.
