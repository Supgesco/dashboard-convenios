# Design

## Context

O que a mudança precisa está em `proposal.md` e nos requisitos de `specs/painel-web/spec.md`. Do código atual, interessa o seguinte:

- `/painel/municipios` devolve `convenios` por município. A contagem vem do recorte (`v_recorte_convenio`), e o mês afeta só os saldos.
- Sem `municipio`, a API devolve todos os municípios com convênio no recorte. Com `tamanho=100`, cabem os 92 do RJ.
- `useOpcoesMunicipios(recorte)` (`web/src/api/hooks.ts`) já faz exatamente esse pedido, `recorte` + `tamanho=100` + `ordem=municipio` e sem mês, para o seletor da barra de filtros, mas devolve só os nomes.
- A tela Municípios (`web/src/telas/Municipios.tsx`) tem cabeçalho e tabela, e a linha da tabela navega com `buscaGlobal(busca, { municipio })`.
- Nos nomes, a API usa a forma oficial de `dominios.MUNICIPIOS_RJ`, que segue a lista do IBGE.
- Os testes rodam no jsdom, e o app anima sempre (`ANIMAR` em `src/movimento.ts`).

## Goals / Non-Goals

**Goals:**
- Um pedido à API por recorte, compartilhado entre o mapa e o seletor de municípios.
- Contornos versionados e reproduzíveis, sem chamada ao IBGE em tempo de execução.
- Junção por nome e faixas em código puro, testável sem Leaflet.

**Non-Goals:**
- Outras métricas no mapa, como saldos ou valor total. Só a quantidade de convênios.
- Zoom automático na seleção, camadas extras ou mapa em outras telas.
- Navegação dos municípios pelo teclado dentro do mapa. A tabela logo abaixo é a alternativa acessível e tem todos os municípios com convênio.

## Decisions

### 1. Dados: uma consulta "todos os municípios do recorte", reaproveitada pelo seletor
É uma consulta nova, `useMunicipiosRecorte(recorte)`, com a mesma chave de cache do `useOpcoesMunicipios`. Ela devolve `{ municipio, convenios }[]`. O seletor passa a usar essa consulta com `select` para tirar só os nomes. Com isso, o mapa e o seletor fazem um único pedido por recorte, sem mês, e trocar o mês não refaz nada.

*Alternativa:* usar o `useMunicipios` da tabela. Foi descartada porque ele é paginado, depende do mês e respeita o filtro de município, e o mapa precisa de todos os municípios para apagar os que estão fora da seleção.

### 2. Contornos: GeoJSON gerado por script e versionado
`web/scripts/gerar-malha-rj.mjs`, rodado à mão com `npm run mapa:malha`, precisa de internet e faz o seguinte:
1. baixa a malha do IBGE: `servicodados.ibge.gov.br/api/v3/malhas/estados/33?intrarregiao=municipio&qualidade=intermediaria&formato=application/vnd.geo+json`;
2. baixa os nomes em `api/v1/localidades/estados/33/municipios`;
3. troca o `codarea` por `{ codigo_ibge, nome }`;
4. arredonda as coordenadas para 4 casas;
5. grava `web/src/mapa/municipios-rj.json`.

O script falha se não sair com exatamente 92 municípios. A qualidade `intermediaria` do IBGE (a `minima` fica grosseira com zoom) dá uns 140 KB com 4 casas, sem ferramenta de simplificação. O arquivo é importado só pelo módulo do mapa, então vai no pedaço carregado sob demanda.

*Alternativa:* buscar a malha no IBGE em tempo de execução. Foi descartada porque deixaria o painel dependente da disponibilidade do IBGE e causaria um pedido externo a cada sessão.

### 3. Junção por nome normalizado
A função pura `juntar(feicoes, linhas)` compara os nomes por `chave()`, que tira acentos, ignora maiúsculas e deixa só letras e números, como `dominios.chave()`. Essa função fica num módulo novo do web, e o resultado é uma quantidade por feição, com 0 quando não há linha. Um teste confere que os 92 nomes do GeoJSON casam com a lista de municípios da API, que é a lista oficial do IBGE. Uma linha da API que não case com nenhuma feição gera `console.warn`, e o mapa continua funcionando.

### 4. Faixas
A função pura `faixas(quantidades, max = 5)` usa só as quantidades maiores que zero, sem repetição:
- se houver até `max` valores distintos, cada valor é uma faixa;
- se houver mais, os cortes ficam nos quantis, ajustados para inteiros distintos, e cada faixa vira um intervalo fechado `[a, b]`, sem lacuna entre uma e a próxima.

O zero não entra em faixa nenhuma e vira "Sem convênio", em cinza (`slate-200`). As cores são uma rampa de um só matiz, a marca, do claro ao escuro: 5 passos, dos quais se usam os últimos *n* quando há menos faixas, para a faixa mais alta ser sempre a mais escura. A rampa é validada com o validador da skill de visualização (modo `light`, superfície branca), e o resultado fica registrado num comentário, como em `series.ts`.

### 5. Mapa: `react-leaflet` v5, carregado sob demanda
O componente `MapaMunicipios` usa `MapContainer`, `TileLayer` e `GeoJSON`. A tela importa o componente com `React.lazy` e mostra o skeleton de `Carregando` enquanto o pedaço baixa.

- **Enquadramento e altura:** o mapa abre ajustado aos limites do RJ (`fitBounds`), com zoom limitado ao estado e arrasto preso ao estado (`maxBounds`). A rolagem do mouse só dá zoom com o mapa em foco (`scrollWheelZoom` ao clicar), para não sequestrar a rolagem da página. A altura é de uns 420 px.
- **Estilo dos contornos:** borda branca de 1 px e preenchimento na cor da faixa. No hover, a borda fica `slate-800` com 2 px e o contorno vai para a frente.
- **Filtro de município:** os municípios fora da seleção ficam com opacidade de preenchimento de 0,25.
- **Dica e clique:** a dica é a `Tooltip` do Leaflet, que segue o mouse, com o texto em tinta slate. O clique usa `navigate('/convenios' + buscaGlobal(busca, { municipio }))`; município sem convênio fica com cursor padrão e sem handler.
- **Fundo do OSM:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, com `attribution` padrão. A camada do fundo recebe `filter: grayscale(1) contrast(.9) brightness(1.05)` e opacidade de 0,6 por classe CSS. Só o fundo é atingido, os polígonos não. A falha do fundo não afeta a camada de contornos, que é local.
- **Legenda:** é HTML fora do canvas, abaixo do mapa, para poder ser lida e testada.
- **Animação:** os polígonos entram com fade e as cores mudam com transição CSS (`transition: fill .4s`) ao trocar o recorte. Isso vale sempre, conforme a decisão do projeto.

*Alternativa:* um SVG próprio com d3-geo, sem fundo. Foi descartada porque o usuário pediu Leaflet e o fundo do OSM.

### 6. Testes
- **Lógica pura:** `juntar`, `faixas` (poucos valores, muitos valores sem lacuna, só zeros, empates), o texto da dica (singular e plural) e a URL do clique ficam em `web/src/mapa/*.test.ts`. São testes sem Leaflet.
- **Tela:** em `painel.test.tsx`, o módulo do mapa é substituído por um dublê leve com `vi.mock`, que mostra a legenda real e um botão por município, para testar a legenda, as faixas por recorte, a falha só no mapa com a tabela intacta e o clique levando a `/convenios` com recorte, município e mês. O Leaflet não é exercitado no jsdom.
- **Contornos:** um teste importa `municipios-rj.json` e confere que há 92 feições e que os nomes casam com a lista oficial. A lista vem de uma fixture com os 92 nomes oficiais, que são dado público.

## Risks / Trade-offs

- **Volume de pedidos ao OSM:** a política de uso do OSM limita uso intenso. → O uso aqui é interno e de baixo volume, o crédito fica visível e o navegador faz cache dos tiles. Trocar de provedor depois é só mudar a URL.
- **Nome divergente entre IBGE e API, como "Parati" e "Trajano de Morais":** → o teste de nomes falha na geração do arquivo, e o script grava sempre o nome oficial do IBGE, que é a mesma fonte de `MUNICIPIOS_RJ`. Uma divergência real se corrige no script.
- **Tamanho do pacote:** o Leaflet tem uns 40 KB gzip, e o GeoJSON uns 100–200 KB. → Os dois só entram no pedaço do mapa, carregado sob demanda na tela Municípios.
- **Ícones e CSS do Leaflet com o Vite:** não se usam marcadores, então o problema conhecido dos ícones não aparece. O `leaflet/dist/leaflet.css` é importado no módulo do mapa.
- **Acessibilidade:** os polígonos não recebem foco. → A tabela da mesma tela tem os mesmos municípios e quantidades, e o mapa ganha `aria-label` e uma descrição dizendo que a tabela abaixo traz os dados.
