# Tasks

## 1. Base: tokens, recortes e contagem

- [x] 1.1 Em `web/src/index.css`, criar os tokens de cor com `@theme`: `--color-gelo` e a escala `--color-marca-50…900`, com âncora `#1d5fc4`. Mover `.cartao`, `.botao-*`, `.campo` e `.titulo-secao` para `marca`, gelo e `rounded-xl`. Conferir com o `contrast()` do validador de dataviz que `marca-700` passa de 4,5:1 sobre o branco e sobre o gelo. Verificação: `npx tsc -b && npm run build` sem erro, e o resultado do contraste anotado em comentário no CSS.
- [x] 1.2 Criar `web/src/recortes.ts` com `NOME_RECORTE`, `ORDEM_EXIBICAO` (`342`, `89`, `31`) e `rotuloRecorte(r, n?)`, que usa o singular "1 convênio" e devolve só o nome quando não há número. Remover `ROTULO_RECORTE` de `BarraFiltros` e trocar o import em `VisaoGeral`. Verificação: teste unitário de `rotuloRecorte` (com número, sem número, singular) em `npm test`.
- [x] 1.3 Em `web/src/api/hooks.ts`:
  - passar `useResumoGeral` para a chave `['resumo-geral', '342']`;
  - criar `useContagemRecortes()` com `useQueries`, um `/painel/resumo?recorte=r` por recorte, sem município e sem mês, lendo `convenios`, com `staleTime` de 5 min;
  - garantir que o 342 aproveita o cache do resumo geral.

  Verificação: teste mostrando que, ao abrir `/`, saem só dois pedidos de resumo a mais (recortes 31 e 89, sem `municipio` nem `ano`/`mes`), e que o pedido do 342 não se repete.

## 2. Layout e filtros

- [x] 2.1 Reescrever `web/src/componentes/Layout.tsx` com a sidebar e a gaveta:
  - sidebar fixa em `lg+`: título, `nav aria-label="Telas"` com ícones SVG em linha e o item ativo destacado;
  - em tela estreita, uma barra superior com o botão "Menu" (`aria-expanded`, `aria-controls`), que abre a mesma sidebar como gaveta;
  - a gaveta fecha ao mudar de rota, com Esc e com clique no fundo.
  - O alerta de filtro inválido e "Limpar filtros" continuam.

  Verificação: teste que abre a gaveta, clica em Convênios e confere a rota nova e `aria-expanded="false"`; `App.test.tsx` passando.
- [x] 2.2 Reestilizar `web/src/componentes/BarraFiltros.tsx` como cartão no topo do conteúdo:
  - seletor segmentado na `ORDEM_EXIBICAO`, com o nome em destaque e a contagem abaixo, e o nome acessível igual ao rótulo completo (`rotuloRecorte`);
  - municípios com chips;
  - mês com "último disponível".

  Verificação: testes novos de rótulos com a contagem da fixture, da ordem 342 → 89 → 31, do rótulo só com o nome quando o resumo de contagem responde 500 (e escolher o recorte ainda funciona) e da contagem que não muda ao selecionar um município.
- [x] 2.3 Atualizar os testes que usam os rótulos antigos (`/31 · vigentes/`, `/89 · primeiro repasse/`, `/342 · todos/`) e o `findByText(/convênios · recorte/)` em `App.test.tsx`, `telas/painel.test.tsx` e `telas/Cargas.test.tsx`. Nos testes que filtram os pedidos de `/painel/resumo` pelo recorte, ignorar os pedidos de contagem com um auxiliar. Verificação: `npm test` todo verde.

## 3. Cards, tabelas e gráfico

- [x] 3.1 Em `web/src/telas/comum.tsx`, criar o `CartaoDestaque`:
  - valor grande com algarismos tabulares;
  - variação com seta ▲/▼ e sinal, em cor neutra, mantendo `data-testid="variacao-<campo>"`;
  - marca na cor da série.

  `CartoesSaldo` passa a usá-lo. Verificação: teste de que uma variação positiva mostra "+12,5%" com a seta para cima e uma ausente mostra "—" sem seta.
- [x] 3.2 Em `web/src/telas/VisaoGeral.tsx`, trocar a linha "N convênios · recorte …" pelo card de convênios, com a quantidade, o nome do recorte, os municípios e o mês. Renomear o título da cobertura para "Cobertura: vinculado aos convênios × total do SIAFE". Verificação: os testes da Visão geral (31, 342, com município) passando, buscando o card pelo papel ou rótulo.
- [x] 3.3 Em `web/src/componentes/TabelaPaginada.tsx`:
  - contêiner com `max-h-[70vh] overflow-auto`;
  - `thead` fixo (`sticky top-0`) e o canto fixo com `z` acima;
  - zebra suave;
  - linha clicável com destaque no hover e anel em `focus-visible`;
  - cabeçalho em caixa normal e paginação mais discreta.

  Aplicar o mesmo estilo às tabelas da cobertura, da visão em tabela do gráfico e do histórico em `Cargas.tsx`. Verificação: `componentes.test.tsx` passando, com a ordenação, a paginação e o Enter na linha.
- [x] 3.4 Em `web/src/componentes/GraficoSerie.tsx`:
  - trocar `SERIES` para `#1d5fc4`, `#d9772b`, `#4fa8e0` e `#1c8f7a`, nessa ordem;
  - ajustar a grade e os eixos para tons de gelo e slate.

  Rodar de novo `node scripts/validate_palette.js "#1d5fc4,#d9772b,#4fa8e0,#1c8f7a" --mode light --surface "#ffffff"`, com e sem `--pairs all`, e registrar o resultado no comentário de `SERIES`: PASS com aviso de contraste no azul claro, que a legenda e a tabela atendem. Verificação: as duas execuções do validador dão PASS em lightness, chroma, CVD e visão normal.

## 4. Textos sem termos de planilha

- [x] 4.1 Em `web/src/telas/Detalhe.tsx`:
  - o 404 passa a ser "Não há convênio X em Y.", sem citar a planilha;
  - "Recortes" mostra os nomes na `ORDEM_EXIBICAO`;
  - os blocos contratuais passam a ser "Valores contratuais · Vigentes" ou "· Primeiro realinhamento";
  - o aviso sem contratual vira "…não está nos recortes Vigentes nem Primeiro realinhamento".

  Atualizar `painel.test.tsx`, que hoje busca as regiões "Valores contratuais · aba 31/89". Verificação: os testes do detalhe (vigente, só 342, 404, 422, compartilhado) passando.
- [x] 4.2 Procurar `aba`, `planilha` e números de recorte soltos nos textos visíveis de `web/src` (`rg -n "aba |planilha|· 31|· 89|· 342" web/src --glob '!*.test.*'`). Deixar só a identificação da importação (rodapé das datas e seção Planilha de Cargas). Verificação: o `rg` só acha essas ocorrências.

## 5. Fechamento

- [x] 5.1 Atualizar `web/README.md`: o layout com sidebar, os nomes dos recortes e de onde vem a contagem. Revisar se o `CLAUDE.md` descreve algo que mudou (rótulos ou layout) e ajustá-lo. Verificação: o README descreve a contagem vinda de `/painel/resumo`, sem números fixos.
- [x] 5.2 Verificação geral:
  - `npx tsc -b`, `npm test`, `npm run lint` e `npm run build` sem erro;
  - abrir o front localmente apontando para uma API e conferir no navegador, em tela larga e estreita: a sidebar e a gaveta, o cabeçalho fixo nas tabelas de Municípios e Convênios, os cards e o gráfico.
  - Fazer só leituras, sem disparar carga e sem capturas de tela com dados reais.
