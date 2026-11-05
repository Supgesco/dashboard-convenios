# Proposal

## Why

O front (`web/`) funciona, mas parece uma planilha. O menu é uma faixa escura no topo e os filtros ficam numa barra fina. Os recortes aparecem como números de aba ("31 · vigentes", "89 · primeiro repasse", "342 · todos"), e o rótulo do 89 está errado: o certo é "primeiro realinhamento". Várias telas ainda falam em "aba" e "planilha". Para quem usa o painel, os recortes são grupos de convênios, e a tela deve mostrar esses grupos pelo nome e com a quantidade de convênios.

## What Changes

- **Navegação em sidebar**: o menu de telas passa para uma barra lateral fixa à esquerda, só com a navegação (Visão geral, Municípios, Convênios, Cargas). Em telas estreitas, a sidebar vira um menu recolhível aberto por um botão.
- **Filtros no topo do conteúdo**: o recorte, os municípios e o mês de referência ficam num bloco visível acima de cada tela que usa filtros, e não mais numa faixa colada ao cabeçalho.
- **Recortes com nome fixo e contagem vinda da API**:
  - os recortes passam a se chamar "Histórico inicial", "Primeiro realinhamento" e "Vigentes";
  - cada um mostra a quantidade de convênios, que vem da API e nunca é fixada no código;
  - um seletor segmentado, nessa ordem, deixa à vista que cada recorte está contido no anterior (342 ⊃ 89 ⊃ 31).
  - A URL continua com `?recorte=31|89|342`, e o padrão continua 31.
- **Sem termos de planilha nas telas**:
  - os textos deixam de citar "aba", "planilha" e números de aba;
  - o detalhe passa a rotular os blocos contratuais pelo nome do recorte;
  - a cobertura passa a se chamar "vinculado aos convênios × total do SIAFE".
  - As datas de carga continuam informando a importação da planilha, porque esse é o nome real da fonte.
- **Cards de destaque (KPI)**:
  - os 4 saldos SIAFE viram cards maiores, com o valor em destaque e a variação sobre o mês anterior indicada por seta e sinal, e não só pela cor;
  - a quantidade de convênios do filtro também ganha destaque.
- **Tabelas mais leves**: zebra suave, números alinhados à direita com algarismos tabulares, cabeçalho fixo na rolagem e menos bordas.
- **Paleta "branco gelo e azul"**:
  - fundo branco gelo, superfícies brancas e o azul como cor dominante da interface;
  - a paleta categórica das 4 séries do gráfico é revista para combinar com o azul, com tons vizinhos suaves e um acento quente, e é validada de novo no validador da skill de dataviz em modo claro.
- Os testes que dependem dos rótulos antigos são atualizados.
- A API não muda.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `painel-web`:
  - a navegação passa para a sidebar, recolhível em telas estreitas;
  - a barra de filtros passa a mostrar os recortes pelo nome e com a contagem de convênios vinda da API;
  - a Visão geral apresenta os saldos e a quantidade de convênios em cards de destaque;
  - o detalhe rotula os recortes e os blocos contratuais pelo nome, e não pela aba;
  - entra um requisito novo para os nomes dos recortes e a ausência de termos de planilha;
  - entra um requisito novo para a leitura das tabelas: cabeçalho fixo, números à direita e linhas alternadas.

## Impact

- **Código**: só `web/src`.
  - `componentes/Layout.tsx`: sidebar e menu recolhível.
  - `componentes/BarraFiltros.tsx`: o seletor segmentado com nome e contagem; os rótulos de recorte passam a viver num módulo próprio.
  - `componentes/TabelaPaginada.tsx`, `componentes/GraficoSerie.tsx` (paleta das séries) e `index.css` (tokens de cor e classes base).
  - `telas/comum.tsx` (cards de destaque), `telas/VisaoGeral.tsx`, `telas/Detalhe.tsx`, `telas/Municipios.tsx`, `telas/Convenios.tsx` e `telas/Cargas.tsx` (só estilo).
  - `api/hooks.ts`: um hook novo para a contagem por recorte.
- **API**: nenhuma mudança. A contagem usa `GET /painel/resumo?recorte=…` sem município, e no recorte 342 reaproveita a consulta que o front já faz para o mês padrão.
- **Testes**: mudam os testes que procuram os rótulos antigos (`painel.test.tsx`, `App.test.tsx`, `Cargas.test.tsx`) e entram testes da sidebar, dos rótulos com contagem e do menu recolhível.
- **Dependências**: nenhuma nova. O projeto já usa Tailwind v4, e os ícones podem ser SVG em linha.
- **Docs**: `web/README.md` (como as telas se organizam) e o `CLAUDE.md` se mudar algo descrito ali.
