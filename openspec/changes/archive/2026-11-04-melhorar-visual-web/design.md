# Design

## Context

O front (`web/`) usa React 19, Tailwind v4, React Router, TanStack Query e Recharts. Como está hoje:

- `componentes/Layout.tsx` desenha um cabeçalho escuro com o menu (`nav aria-label="Telas"`). Logo abaixo vem `BarraFiltros`, mas só nas rotas `/`, `/municipios` e `/convenios`.
- `BarraFiltros.tsx` exporta `ROTULO_RECORTE`, com os rótulos "31 · vigentes", "89 · primeiro repasse" e "342 · todos". `VisaoGeral.tsx` também importa esses rótulos.
- Os recortes vêm de `RECORTES = ['31', '89', '342']` (`api/tipos.ts`), e o padrão é 31.
- O mês padrão sai de `useResumoGeral()` (`['resumo-geral']`, que chama `GET /painel/resumo?recorte=342`, sem mês).
- `GET /painel/resumo` devolve `convenios`. O número vem de `consultas.contar_convenios(filtro)`, que depende só do recorte e dos municípios, nunca do mês.
- O estilo usa as cores `slate`/`sky` do Tailwind. As classes base são `.cartao`, `.botao-*` e `.campo`, em `index.css`.
- A paleta do gráfico (`GraficoSerie.tsx`, `SERIES`) é a padrão da skill de dataviz: azul, laranja, verde-água e amarelo.
- Os testes buscam:
  - o menu por `navigation "Telas"`;
  - os botões de recorte pelos rótulos antigos;
  - o texto `/convênios · recorte/` (que aparece em `App.test`, `painel.test` e `Cargas.test`);
  - as regiões "Valores contratuais · aba 31/89".
- O stub de API (`teste/api.ts`) registra todos os pedidos, e alguns testes filtram os de `/painel/resumo` pelo recorte.

## Goals / Non-Goals

**Goals:**

- Layout com sidebar de navegação, que vira menu recolhível em tela estreita, e filtros num bloco no topo do conteúdo.
- Recortes com nome fixo e a contagem de convênios vinda da API, num seletor segmentado.
- Cards de destaque para a quantidade de convênios e os 4 saldos. Tabelas mais leves, com cabeçalho fixo.
- Paleta branco gelo e azul, com as cores das séries validadas pelo script da skill de dataviz.
- Nenhum termo de aba ou de planilha nas telas, exceto a identificação da importação.

**Non-Goals:**

- Mudar a API, os endpoints ou os parâmetros da URL.
- Modo escuro. O app não tem hoje e continua sem.
- Logo ou identidade institucional.
- Telas, filtros ou indicadores novos. Quem decide quais dados aparecem são as specs atuais.
- Biblioteca de componentes ou de ícones: os poucos ícones necessários são SVG em linha.

## Decisions

### 1. Nomes dos recortes num módulo próprio

`src/recortes.ts` passa a concentrar:

- `NOME_RECORTE: Record<Recorte, string>` (`'342' → 'Histórico inicial'`, `'89' → 'Primeiro realinhamento'`, `'31' → 'Vigentes'`);
- `ORDEM_EXIBICAO = ['342', '89', '31']`;
- `rotuloRecorte(r, n?)`, que devolve "Vigentes (31 convênios)" quando há número e só "Vigentes" quando não há. Usa `inteiro()` e o singular "1 convênio".

`ROTULO_RECORTE` sai de `BarraFiltros`, e todas as telas usam esse módulo.

- **Ordem de exibição**: do maior para o menor. É a ordem em que o usuário citou os recortes, e mostra que cada um está contido no anterior.
- **O que não muda**: `RECORTES` (a validação da URL) e o padrão 31.

### 2. A contagem vem de `/painel/resumo` sem município

`useContagemRecortes()` usa `useQueries` com uma consulta por recorte. Cada consulta chama `/painel/resumo?recorte=r`, sem município e sem mês, e lê o campo `convenios`.

- **A chave de cache passa a ser `['resumo-geral', r]`.** `useResumoGeral()` passa a ser `['resumo-geral', '342']`, com a mesma função de busca. Assim a contagem do 342 aproveita o pedido que já existe, e só os recortes 31 e 89 geram pedidos novos: dois por sessão, com `staleTime` de 5 min.
- **Por que funciona sem mês**: `convenios` não depende do mês (`contar_convenios` só olha recorte e municípios), então qualquer mês serve.
- **Alternativas descartadas**:
  - `/painel/convenios?tamanho=1`, lendo o `total`: o custo seria parecido e a semântica, pior;
  - números fixos no código: o usuário pediu a contagem da API;
  - um endpoint novo: está fora do escopo, porque a API não muda.
- **Sem número**: enquanto carrega, ou se falhar, o rótulo fica só com o nome. A falha não vira erro na tela, e o filtro continua funcionando.

### 3. Layout: sidebar fixa em `lg+` e gaveta em tela estreita

- **Telas a partir de `lg`**:
  - o `Layout` é uma grade `[sidebar 15rem | conteúdo]`;
  - a sidebar é branca, com borda à direita, o título "Painel de convênios" em azul e o `nav aria-label="Telas"`;
  - os itens têm ícone e rótulo, e o item ativo fica com fundo azul claro, texto azul-escuro e uma barra lateral azul.
- **Telas estreitas**:
  - uma barra superior mostra o título e um botão "Menu" (`aria-expanded`, `aria-controls`) que abre a mesma sidebar como gaveta sobre o conteúdo, com fundo escurecido;
  - a gaveta fecha ao trocar de rota (efeito sobre `pathname`), com Esc e com clique fora.
- **Um único `nav` no DOM, só escondido por CSS**: os testes (jsdom) não aplicam CSS, então continuam achando os links. O teste da gaveta confere `aria-expanded` e o fechamento depois da navegação.
- **Por que uma sidebar clara, e não um bloco azul-escuro**: combina com o branco gelo e deixa o azul para o que é ativo ou clicável. O azul-escuro pesaria a tela ao lado dos cards.

### 4. Bloco de filtros no topo do conteúdo

`BarraFiltros` vira um cartão no topo de `main`, só nas rotas com filtro. O comportamento é o mesmo de hoje: `TELAS_COM_FILTROS` continua igual.

- **Recorte**: seletor segmentado grande (`role="group" aria-label="Recorte"`, botões com `aria-pressed`). Cada botão mostra o nome em destaque e a contagem embaixo, menor. O nome acessível é o rótulo completo, "Vigentes (31 convênios)".
- **Municípios**: o seletor atual (`<details>`, busca e checkboxes), com os municípios escolhidos em chips logo abaixo.
- **Mês**: o `input type="month"` atual, com "último disponível" visível.
- **Arranjo**: os três ficam lado a lado em telas largas e empilhados em telas estreitas.

### 5. Tokens de cor (Tailwind v4 `@theme`)

`index.css` ganha estes tokens:

| Token | Valor | Uso |
|---|---|---|
| `--color-gelo` | `#f4f7fb` | fundo da página |
| superfície | `white` | cartões, sidebar, tabelas |
| `--color-marca-50…900` | escala azul (âncora `#1d5fc4` em 600) | ativo, links, botão primário, foco |
| texto | `slate-900` / `slate-600` / `slate-500` | primário / secundário / apagado |
| bordas | `slate-200` | linhas finas |

- **Classes base**: `.cartao`, `.botao-*` e `.campo` passam a usar `marca` no lugar de `sky`. Os cartões ganham borda mais suave e cantos `rounded-xl`.
- **Cores reservadas**: o âmbar continua só na marca de código compartilhado, e o vermelho só nos erros.
- **Contraste**: o texto em `marca-700` sobre o branco e sobre o gelo deve passar de 4,5:1, e isso é conferido com o `contrast()` do validador.

### 6. Paleta das séries, validada

As cores seguem a ordem fixa dos campos:

| Série | Cor | Papel |
|---|---|---|
| A pagar | `#1d5fc4` | azul dominante |
| A comprovar | `#d9772b` | acento quente |
| A aprovar | `#4fa8e0` | azul claro, vizinho |
| Aprovados | `#1c8f7a` | verde-azulado |

Resultado de `validate_palette.js` em modo claro, sobre `#ffffff`, a superfície do cartão do gráfico:

- **Pares adjacentes**: tudo PASS. A separação para daltonismo fica em ΔE ≥ 15,2, e o piso de visão normal em 16,4.
- **Todos os pares (`--pairs all`)**: também tudo PASS, com pior ΔE de 9,7 para daltonismo e 16,4 para visão normal. Esse modo importa porque, num gráfico de linhas, qualquer par de séries pode se cruzar.
- **Contraste**: aviso para `#4fa8e0` (2,62:1). A legenda está sempre visível, a tabela continua disponível em "Ver tabela", os valores estão no tooltip e os textos nunca usam a cor da série. Isso atende à exigência do aviso.

Candidatas rejeitadas:

- azul, laranja, verde-água e roxo `#9a5bc9`: roxo e azul ficaram em ΔE 3,0 (protan) e 14,9 (visão normal), FAIL em todos os pares;
- variações com magenta ou dourado: também FAIL em todos os pares.

A validação deve ser rodada de novo na implementação, e o resultado fica registrado no comentário de `SERIES`.

### 7. Cards de destaque

`CartoesSaldo` vira uma grade de `CartaoDestaque`.

- **Conteúdo do card**:
  - rótulo pequeno;
  - valor em `text-2xl`/`3xl` com algarismos tabulares;
  - variação com seta (▲/▼, ou nada quando é zero ou ausente) e sinal, no formato de `variacao()`.
- **Variação em cinza**: a cor da variação é neutra (`slate`), sem vermelho nem verde. Nesses saldos, subir não é bom nem ruim por si só, e a spec pede que a direção não dependa da cor.
- **Ligação com o gráfico**: cada card tem uma pequena marca na cor da sua série. A marca é só identidade, porque o texto continua na cor de texto.
- **Card de convênios**: a Visão geral ganha um card no lugar da linha "N convênios · recorte …". Ele mostra a quantidade e, embaixo, o nome do recorte, os municípios e o mês.
- **Detalhe**: usa os mesmos cards de saldo.
- **Testes**: o `data-testid="variacao-<campo>"` fica.

### 8. Tabelas

`TabelaPaginada`:

- o contêiner passa a ter `max-h-[70vh] overflow-auto`, a rolagem nos dois eixos que o `thead` fixo (`sticky top-0`) precisa;
- a coluna fixa à esquerda continua, e o canto do cabeçalho fica com o `z` acima;
- as linhas pares ganham `bg-slate-50/60`;
- passar o mouse ou focar uma linha (`focus-visible`) mostra `bg-marca-50` com um anel;
- o cabeçalho fica em caixa normal, `text-xs` e `font-medium` `slate-600`, sem bordas verticais;
- a paginação usa botões mais discretos e mostra o total à esquerda.

O mesmo estilo vale para as tabelas da cobertura, da visão em tabela do gráfico e do histórico de cargas.

### 9. Textos

| Onde | Antes | Depois |
|---|---|---|
| Detalhe, 404 | "…na planilha carregada." | "Não há convênio X em Y." |
| Detalhe, recortes | `31, 89, 342` | nomes, na ordem de exibição |
| Detalhe, bloco | "Valores contratuais · aba 31" | "Valores contratuais · Vigentes" |
| Detalhe, sem contratual | "…não está nas abas 31 nem 89 da planilha" | "…não está nos recortes Vigentes nem Primeiro realinhamento" |
| Visão geral, cobertura | "vinculado à planilha × total do SIAFE" | "vinculado aos convênios × total do SIAFE" |
| Visão geral, cabeçalho | "N convênios · recorte 31 · vigentes" | card de convênios (decisão 7) |

O rodapé das datas de carga ("planilha importada em … (arquivo)") e a seção Planilha da tela Cargas continuam como estão, porque identificam a fonte.

### 10. Testes

- Os testes que usam os rótulos antigos mudam para os novos nomes. As consultas por papel continuam (`button`, `navigation`, `region`).
- O `findByText(/convênios · recorte/)` vira a espera pelo card de convênios.
- Os testes que filtram os pedidos de `/painel/resumo` pelo recorte passam a ignorar os pedidos de contagem (sem `municipio`, sem `ano`/`mes`), com um auxiliar no próprio teste.
- Entram testes novos para:
  - os rótulos com a contagem da API e a ordem 342 → 89 → 31;
  - o rótulo sem número quando a contagem falha;
  - a contagem que não muda com o filtro de município;
  - a gaveta, que abre, navega e fecha.

## Risks / Trade-offs

- **Pedidos extras**: dois `GET /painel/resumo` a mais por sessão. Cada um calcula os saldos do mês corrente sem precisar deles. O custo é baixo, e a alternativa (um endpoint de contagem) mudaria a API. → Fica aceito e registrado aqui.
- **Mês corrente sem dados**: o resumo sem mês usa o mês corrente da API. Se não houver dados desse mês, os saldos vêm nulos, mas `convenios` vem certo, e só esse campo é lido. → Sem risco para a contagem.
- **Testes que contam pedidos**: os pedidos de contagem podem quebrar testes que contam ou filtram pedidos de resumo. → Esses testes são ajustados (decisão 10), e o "só GET" continua valendo.
- **Cabeçalho fixo com rolagem horizontal**: quando a tabela ganha rolagem própria, a página passa a ter duas rolagens. → A altura máxima fica em 70vh, e a coluna fixa e o cabeçalho são testados à mão nas telas Municípios e Convênios.
- **A sidebar tira largura**: as tabelas largas (Convênios no 31/89) rolam na horizontal mais cedo. → Mantêm a coluna fixa, e a sidebar só aparece em `lg+`.
- **Gosto visual**: a paleta da interface e o estilo da sidebar são escolha de design. → Os tokens ficam concentrados em `index.css`, para ajustar sem tocar nos componentes.
