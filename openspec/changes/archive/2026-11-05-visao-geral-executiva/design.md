# Design

## Context

O que já existe e serve de base:

- **Hooks:**
  - `useResumoGeral()` pede `GET /painel/resumo?recorte=342` sem município e sem mês.
  - `useContagemRecortes()` pede o mesmo resumo para 31, 89 e 342 (`consultaResumoSemFiltro`), com cache compartilhado.
  - Quando a Visão geral abre, os resumos sem filtro do 342 e do 31 já estão em cache ou sendo pedidos pela barra lateral e pelo seletor.
- **O que esses resumos já trazem:**
  - o resumo do 342 traz `convenios`, `situacao.status` e `referencia` (datas das cargas);
  - o resumo do 31 traz `convenios` e `contratual` (valor total, investido, a repassar).
  - Os valores contratuais e a contagem não dependem do mês; o mês só afeta os saldos SIAFE.
- **Contagem de municípios:** não está no resumo. O campo `municipios` do resumo é a lista do filtro, e não uma contagem. `GET /painel/municipios` traz `total`, que é a quantidade de municípios com convênio no recorte, e aceita `ordem=-convenios` (com desempate por município, em `ORDEM_RANKING`).
- **URL:** `filtros.ts` separa os filtros globais (`recorte`, `municipio`, `ano`, `mes`), que os links do menu levam por `buscaGlobal`, de `pagina` e `ordem`, que são de cada tela. `Layout.tsx` mostra `BarraFiltros` e o aviso de filtro inválido só nas rotas de `TELAS_COM_FILTROS`.
- **SQL dos percentuais:** `consultas.py` calcula o `execucao_pct` em três lugares (`_SOMA_CONTRATUAIS`, lista e detalhe), sempre como `round(100 * soma(investido) / nullif(soma(repasse), 0), 2)`.
- **Visual:** o restyle da web (cards `cartao-kpi`, `BarraProgresso`, barras proporcionais em `Situacao`, tabelas sem zebra) ainda não tem commit. Esta change parte dele.

## Goals / Non-Goals

**Goals:**

- Montar a Visão geral só com rotas que já existem, mais um campo novo no bloco contratual.
- Reaproveitar o cache dos resumos sem filtro, para que a Visão geral não repita pedidos.
- Manter os filtros da URL intactos quando o usuário passa pela Visão geral.

**Non-Goals:**

- Nenhuma rota nova nem view nova: o "total de municípios" sai do `total` de `/painel/municipios`.
- O detalhe e a tela Municípios não mudam, fora o campo novo nos tipos.
- Recharts não entra nos gráficos novos, que são barras horizontais em HTML/CSS (ver Decisões).
- O mês de referência não muda de regra nas telas com filtro.

## Decisions

### 1. Fontes de dados da Visão geral

| Bloco | Pedido | Novo? |
|---|---|---|
| Cadastrados (342) e status | `consultaResumoSemFiltro('342')` | não, está em cache |
| Vigentes (31) e contratual | `consultaResumoSemFiltro('31')` | não, está em cache |
| Municípios do 342 e top 10 | `/painel/municipios?recorte=342&ordem=-convenios&tamanho=10` | sim; o `total` dá os 83 |
| Municípios do 31 | `/painel/municipios?recorte=31&tamanho=1` | sim; só o `total` interessa |
| Lista dos vigentes | `/painel/convenios?recorte=31&ordem=<url ou -valor_total>&pagina=<url>` | sim |

Esses pedidos vão sem `ano`/`mes`, e a API usa o mês corrente. Isso não muda nenhum número da tela, porque contagens e contratuais não dependem do mês. As colunas de saldo da lista dos vigentes, que dependeriam do mês, não aparecem.

**Alternativa recusada:** incluir uma contagem de municípios no `/painel/resumo`. O resultado seria mais compacto, mas o resumo já tem um `municipios` com outro sentido, e a contagem já existe no `total` do ranking. Se o pedido com `tamanho=1` incomodar, isso pode ser revisto sem mudar a spec.

### 2. Visão geral fora dos filtros, sem perder a URL

- `/` sai de `TELAS_COM_FILTROS`. Assim, a barra de filtros e o aviso de filtro inválido somem dessa tela.
- A Visão geral não chama `useFiltros().filtros.recorte`/`municipios`/`mes`. Ela lê da URL só `pagina` e `ordem`, que são da lista dos vigentes e seguem o mesmo padrão das outras listas (`aplicarMudanca`).
- Os links do menu continuam montados com `buscaGlobal(busca)`. Por isso, passar pela Visão geral leva adiante o `recorte`/`municipio`/`mes` que estavam na URL, e o usuário volta para Convênios com os mesmos filtros.
- O clique numa linha da lista abre `linkDetalhe(numero, municipio, <busca vazia>)`. O detalhe fica no mês padrão, porque a Visão geral não tem mês em uso.

### 3. Percentual do investido sobre o valor total na API

- A coluna nova é `round(100 * soma(investido_estado) / nullif(soma(valor_total), 0), 2) AS investido_sobre_total_pct`. Ela entra nos três lugares onde hoje está o `execucao_pct`. No ranking, vem do mesmo CTE de contratuais.
- O modelo `Contratual` ganha o campo, e `LinhaMunicipio`, `LinhaConvenio` e `ContratualRecorte` o herdam.
- O campo entra em `ORDEM_RANKING` e `ORDEM_LISTA`, já que a spec da ordenação aceita qualquer campo numérico da linha.
- Os tipos do front são regenerados com `npm run api:tipos`, e as fixtures sintéticas de `teste/` ganham o campo.
- **Nome:** `investido_sobre_total_pct`, longo mas sem ambiguidade com o `execucao_pct`. Recusei `investido_pct`, que pode ser lido como o próprio percentual de execução.
- **Alternativa recusada:** calcular no front a partir das duas somas. O resultado seria igual, mas o projeto concentra os percentuais na API, que é o lugar onde a regra "quociente de somas" é testada.

### 4. Gráficos de barras em HTML, não Recharts

- Status e top 10 são listas curtas de rótulo, barra e número. O componente `Situacao` do restyle já desenha barras proporcionais em HTML.
- O plano é extrair isso para um componente `BarrasHorizontais({ itens: {rotulo, valor}[], rotuloRegiao })`, usado nos dois gráficos. A barra é `aria-hidden`, e o número fica escrito em texto, como pede a spec.
- **Vantagens:** acessível sem esforço extra, testável por texto com Testing Library e com o mesmo visual dos cards.
- **Alternativa recusada:** o `BarChart` horizontal do Recharts. Ele daria eixo e tooltip, mas tem rótulos longos de município difíceis de acomodar, é pior para testar e pesaria mais sem ganho para 10 barras.
- A cor das barras é uma só (marca-500), porque é uma série única e a cor não codifica nada. Isso segue a regra de cor da skill de dataviz.

### 5. Cards de saldo na tela Convênios

- `CartoesSaldo` (`telas/comum.tsx`) já recebe `saldos` e `anterior`. A tela Convênios passa a chamar `useResumo(filtros, ref.mes)`, com o mesmo filtro e o mesmo mês da lista, e mostra `CartoesSaldo` acima da tabela.
- O aviso de "mês sem dados" que a Visão geral mostrava vai junto para Convênios.
- A falha do resumo aparece no lugar dos cards, sem derrubar a lista: são duas áreas independentes.

### 6. Layout da Visão geral

```
+-----------------+-----------------+-----------------+-----------------+
| Cadastrados     | Vigentes        | Valor total     | Investido pelo  |
| (escuro)        |                 | conveniado      | Estado + % + barra
+-----------------+-----------------+-----------------+-----------------+
| A repassar      |   (em xl os 5 cards ficam numa linha: 5 colunas)    |
+-----------------+-----------------------------------------------------+
| Convênios por status (342)        | Top 10 municípios (342)           |
+-----------------------------------+-----------------------------------+
| Convênios vigentes (TabelaPaginada, ordem padrão -valor_total)        |
+-----------------------------------------------------------------------+
| Posição do SIAFE em ... · planilha importada em ...                   |
+-----------------------------------------------------------------------+
```

- O card Cadastrados usa a variante `escuro` de `CartaoDestaque`, como número principal da tela.
- Os cards de valor usam `cartao-kpi` com a cor da marca. As cores das séries do SIAFE ficam só para os saldos SIAFE.
- O título é "Visão geral", e o subtítulo diz que a tela resume a carteira inteira, sem filtros.

### 7. O que sai do código

- `Cobertura` e `Situacao` (a lista dupla, com situação da vigência) saem de `VisaoGeral.tsx`.
- `GraficoSerie` continua, porque o detalhe o usa.
- `BlocoContratual` continua, porque o detalhe o usa. A Visão geral não o usa mais.
- `useSerie` fica sem uso no front, se só a Visão geral o chamava. Nesse caso, o hook é removido. A rota `/painel/serie` continua na API.

## Risks / Trade-offs

- **Testes da Visão geral (`painel.test.tsx`) mudam quase todos.** A spec antiga deixa de valer → reescrevê-los a partir dos cenários novos e mover os de variação e mês sem dados para Convênios.
- **A Visão geral faz 3 pedidos novos**, além dos resumos em cache → todos são pequenos (`tamanho` 10, 1 e 20). Cada bloco carrega e falha sozinho.
- **A ordem dos recortes no código:** 342 é "cadastrados" porque é o recorte mais amplo (31 ⊂ 89 ⊂ 342). Se um dia a planilha tiver convênio fora da 342, o card deixa de ser "todos" → a spec diz "Histórico inicial", e não "todos", então o texto continua correto.
- **Mês corrente nos pedidos sem mês:** não afeta números exibidos hoje. Se a lista dos vigentes ganhar colunas de saldo no futuro, terá de usar o `ultimo_mes_disponivel` → anotado aqui, fora do escopo.
- **Filtro inválido na URL** (ex.: `recorte=99`) fica invisível na Visão geral, já que ela não usa os filtros → o aviso continua aparecendo ao abrir Municípios ou Convênios.

## Migration Plan

1. Fazer o commit do restyle atual antes, separado, para que esta change parta dele.
2. Fazer a API e os testes primeiro, depois regenerar os tipos e só então o front. O campo novo é aditivo e não quebra o front antigo.
3. Rollback: reverter o commit do front. A API pode ficar com o campo, porque nada mais depende dele.
