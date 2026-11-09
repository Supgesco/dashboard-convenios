# Design

## Context

Motivação e escopo: ver proposal.md. Requisitos: ver os deltas em `specs/`.

O que já existe e molda a abordagem:
- Todas as consultas do painel ficam em `app/painel/consultas.py`, em SQL literal com parâmetros nomeados. Elas começam pelo CTE `_CONV`, que traz os convênios do recorte e do filtro, e pelo `_COD`, que traz os códigos distintos desses convênios. As somas usam `_SOMA_SALDOS` e `_SOMA_CONTRATUAIS`.
- `v_convenio` tem a chave (`numero_convenio`, `municipio`), a `linha` da 342, `status`, `fase` e os códigos escolhidos. `v_convenio_codigo` tem um código distinto por convênio. `v_convenio_saldo` soma `v_convenio_saldo_codigo` por convênio e mês.
- `v_recorte_convenio` (0004) tem uma linha por (recorte, convênio), com `situacao_vigencia`. `v_valor_contratual` (0004) tem uma linha por (recorte 31 ou 89, convênio), já com as linhas de continuação somadas e a escolha entre realinhado e inicial.
- `planilha_convenios_geral` guarda `objeto` e `vigencia_final`, ligados a `v_convenio` pela `linha`.
- A carga da planilha grava o número normalizado (`transformacao.numero_convenio`: `143/14` → `143/2014`, `3-a/2020` → `003-A/2020`). O filtro do painel normaliza municípios com `normalizar_municipios`.
- `etl_execucao` (modelo `EtlExecucao`) já tem todos os campos do histórico. `GET /etl/siafe/status` lê a última linha desse registro.

## Goals / Non-Goals

**Goals:**
- Reutilizar as views e as regras de soma do painel, sem uma segunda versão de "saldo do convênio" nem de "valor contratual".
- Aceitar no detalhe exatamente as grafias que a carga aceita, nem mais nem menos.

**Non-Goals:**
- Migration ou view nova.
- Mudar os endpoints existentes ou o formato das respostas atuais.
- Ordenação ou filtros no histórico de cargas.

## Decisions

### 1. Rota `GET /painel/convenio` com a chave em query params

Os números têm barra (`143/2014`), o que quebra um path parameter comum. A chave também é composta, porque o número sozinho não identifica o convênio. Por isso a rota recebe `numero` e `municipio` como query params obrigatórios. O nome no singular a distingue da lista `/painel/convenios`.

Alternativas consideradas:
- `/painel/convenios/{municipio}/{numero:path}`: exige codificar a barra ou usar um conversor `path`, e o front teria de montar URLs frágeis.
- Um id sintético: as views não têm id estável, porque a carga faz `DELETE` + insert e a `linha` muda a cada revisão da planilha.

### 2. Normalização da entrada pelas funções da carga

O router aplica `transformacao.numero_convenio` ao `numero` e `normalizar_municipios` ao `municipio`:
- se a função de número devolve aviso ou valor nulo, a resposta é 422 com o motivo;
- se o município não é reconhecido, a resposta é 422 no mesmo formato do filtro, `{"msg", "municipios_invalidos"}`;
- se um dos dois parâmetros vem vazio, a resposta também é 422.

Assim a regra de grafia fica num único lugar: se a carga passar a aceitar outra grafia, o detalhe acompanha.

### 3. O detalhe é montado por consultas pequenas, não por uma consulta única

`consultas.py` ganha funções que recebem a chave já normalizada:
- `convenio(conn, numero, municipio) -> dict | None`: lê `v_convenio` + `planilha_convenios_geral` (objeto, vigência) + `v_recorte_convenio` (`array_agg` dos recortes, `situacao_vigencia`). Se devolve `None`, a resposta é 404.
- `compartilhamentos(conn, numero, municipio) -> list[dict]`: os outros convênios de `v_convenio_codigo` com um código em comum, com número, município e código, ordenados por município, número e código.
- `saldos_convenio(conn, numero, municipio, ano, mes)` e `serie_convenio(conn, numero, municipio)`: as mesmas consultas de `saldos` e `serie` com um CTE `conv` de um convênio só no lugar de `_CONV`. Reaproveitam `_COD` e `_SOMA_SALDOS`, então a soma de códigos distintos e o "mês sem dados → nulo" ficam idênticos aos do painel.
- `contratual_convenio(conn, numero, municipio) -> list[dict]`: as linhas de `v_valor_contratual` da chave, uma por recorte, com o mesmo arredondamento e o mesmo `execucao_pct` da lista.

O router decide o mês anterior com `mes_anterior` e devolve nulo quando `mes_tem_dados` é falso, como no resumo.

O bloco `conv` de um convênio pode ser obtido generalizando `_CONV` com um filtro opcional de número, ou escrito como um CTE à parte. A escolha fica para a implementação, desde que `saldos` e `serie` não mudem de resultado.

Alternativa considerada: uma consulta única com `json_agg`. Ela é mais rápida, mas duplicaria as regras de soma e seria mais difícil de testar parte por parte. O volume (um convênio, cerca de 47 meses) não pede isso.

### 4. Valores contratuais por aba, sem escolher uma

A 31 e a 89 trazem valores diferentes para o mesmo convênio. A 31 é a foto de 2025; a 89 tem o histórico do primeiro repasse. O painel já usa a regra "cada recorte usa a própria aba". O detalhe devolve `contratual` como uma lista de blocos com `recorte`, e o front escolhe qual destacar, em geral o do recorte selecionado. Escolher no back-end esconderia uma das duas fontes.

### 5. Formato da resposta do detalhe

```
{
  "numero_convenio", "municipio", "fase", "status", "situacao_vigencia",
  "vigencia_final", "objeto", "recortes": ["89", "342"],
  "codigo_seobras", "codigo_seiop",
  "codigo_compartilhado": bool,
  "compartilhado_com": [{"numero_convenio", "municipio", "codigo"}],
  "referencia": {"ano", "mes"},
  "saldos": Saldos | null, "mes_anterior": Saldos | null,
  "contratual": [{"recorte", ...Contratual}],
  "serie": [PontoSerie]
}
```

Os modelos `Saldos`, `Contratual` e `PontoSerie` do router são reaproveitados.

### 6. Histórico no router de ETL, com paginação própria

`GET /etl/siafe/execucoes` fica em `app/routers/etl.py` e usa `select(EtlExecucao)` com `ORDER BY id DESC LIMIT/OFFSET` e `count(*)`. O item usa o modelo `ExecucaoStatus`, e o envelope é `{pagina, tamanho, total, itens}`.

A paginação de `consultas.py` foi descartada aqui: ela existe para SQL literal ordenável por whitelist, e o histórico tem uma ordem fixa. Importar o painel no router de ETL criaria uma dependência sem ganho. Os limites (`ge=1`, `1..100`, padrão 20) são os mesmos, declarados nos `Query`.

O `id DESC` acompanha `inicio DESC`, porque o id é sequencial e a reserva grava `inicio` no mesmo momento. Isso também dá ordem estável entre páginas.

## Risks / Trade-offs

- [O campo `erro` vai para a tela] → Hoje o texto é `"<Tipo>: <mensagem>"` limitado a 2000 caracteres. As mensagens do cliente SIAFE trazem só a rota e o status, e o engine usa `hide_parameters=True`. O requisito "Sigilo de credenciais" já cobre o registro de execuções. Um teste do histórico com uma falha sintética de autenticação confere que o texto não contém usuário, senha nem token.
- [`POST /etl/siafe` sem autenticação, e agora com botão no front] → A trava 409 continua impedindo cargas simultâneas, e o README passa a dizer que a API só pode rodar em rede interna. A autenticação fica para uma change futura.
- [O número de outro formato na base] → Uma linha cujo número a carga não reconheceu fica nula e não vira convênio, então nenhum convênio fica inacessível pelo detalhe.
- [O detalhe faz várias consultas por requisição] → São seis consultas pequenas indexadas pela chave, sobre volume baixo. Se pesar, dá para juntar sem mudar o contrato.

## Migration Plan

Não há migration. O deploy é a nova versão da API; o rollback é a versão anterior, já que nenhum endpoint existente muda.
