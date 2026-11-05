# Tasks

## 1. Dependências e contornos

- [x] 1.1 Instalar `leaflet`, `react-leaflet` (v5) e `@types/leaflet` em `web/`; verificar com `npm ls leaflet react-leaflet` e `npm run build` sem erro
- [x] 1.2 Escrever `web/scripts/gerar-malha-rj.mjs` e o script `mapa:malha` no `package.json`. O script baixa a malha e os nomes do IBGE, troca `codarea` por `{ codigo_ibge, nome }`, arredonda as coordenadas para 4 casas e falha se não houver 92 feições. Verificar rodando `npm run mapa:malha`: o comando deve gerar `web/src/mapa/municipios-rj.json` com 92 feições e no máximo uns 250 KB
- [x] 1.3 Teste dos contornos (`web/src/mapa/malha.test.ts`): 92 feições, nomes que casam pela chave normalizada com a lista oficial dos 92 municípios (fixture com dado público) e todo `codigo_ibge` começando por 33. Verificar com `npx vitest run src/mapa/malha.test.ts`

## 2. Lógica pura do mapa

- [x] 2.1 Implementar em `web/src/mapa/` a `chave()` (igual à `dominios.chave()` da API) e a `juntar(feicoes, linhas)`, que devolve a quantidade por feição (0 quando não há linha) e avisa no console quando uma linha não casa com nenhuma feição. Verificar com testes de acento, maiúsculas, município ausente e linha sem par
- [x] 2.2 Implementar `faixas(quantidades, max = 5)`. Verificar com testes:
  - até 5 valores distintos dão uma faixa por valor;
  - de 1 a 40 dá no máximo 5 faixas contíguas, sem lacuna nem sobreposição;
  - só zeros dá nenhuma faixa;
  - os empates não criam faixas vazias.
- [x] 2.3 Definir a rampa de 5 passos de um só matiz (marca) e o cinza "Sem convênio", e a regra de usar os últimos *n* passos. Rodar `validate_palette.js` em modo light sobre o branco, registrar o resultado em comentário e verificar com um teste que a faixa mais alta usa sempre o passo mais escuro
- [x] 2.4 Implementar o texto da dica ("Niterói · 5 convênios", "1 convênio", "0 convênios") e o link do clique (`/convenios` com o município, mantendo recorte e mês e sem `pagina`/`ordem`), reaproveitando `buscaGlobal`. Verificar com testes

## 3. Dados

- [x] 3.1 Criar `useMunicipiosRecorte(recorte)` em `web/src/api/hooks.ts`, devolvendo `{ municipio, convenios }[]`, e fazer o `useOpcoesMunicipios` derivar dele com `select`, na mesma chave de cache. Verificar que os testes da barra de filtros em `App.test.tsx` continuam passando e que um teste novo confirma um único pedido `tamanho=100` por recorte com o mapa e o seletor na tela

## 4. Componente do mapa

- [x] 4.1 Criar `web/src/mapa/MapaMunicipios.tsx` com `react-leaflet`:
  - fundo do OSM com crédito e a classe que o atenua (só na camada de fundo);
  - enquadramento e limites do RJ;
  - rolagem do mouse dá zoom só com o mapa em foco;
  - borda branca e cor por faixa;
  - destaque no hover e `Tooltip` com o texto da 2.4;
  - clique só em município com convênio;
  - opacidade 0,25 para os municípios fora do filtro;
  - transição de cor ao trocar o recorte.
  
  Importar `leaflet/dist/leaflet.css` nesse módulo. Verificar no navegador (5180, API 8010) e capturar telas só no scratchpad
- [x] 4.2 Criar a legenda em HTML (faixas com intervalo e "Sem convênio") fora do mapa, com `aria-label`, e a descrição de que a tabela abaixo traz os dados. Verificar com teste de componente

## 5. Tela Municípios

- [x] 5.1 Pôr o mapa em `web/src/telas/Municipios.tsx`, entre o cabeçalho e a tabela, com `React.lazy` + `Suspense` (`Carregando` enquanto carrega). O mapa tem estados próprios de carregando e de erro (`CaixaErro` com "Tentar de novo"), independentes da tabela, e o título "Convênios por município · {nome do recorte}". Verificar no navegador
- [x] 5.2 Em `web/src/telas/painel.test.tsx`, trocar o módulo do mapa por um dublê com `vi.mock` e cobrir os cenários do spec:
  - cores e legenda seguem o recorte;
  - trocar o mês não faz novo pedido do mapa;
  - Paraty selecionado deixa os outros municípios apagados;
  - o clique em Niterói abre Convênios com recorte 89, Niterói e o mês;
  - município com 0 não navega;
  - falha só no mapa mantém a tabela.
  
  Verificar com `npm test`
- [x] 5.3 Atualizar `web/README.md` e `CLAUDE.md`: mapa na tela Municípios, origem e regeração dos contornos (`npm run mapa:malha`), fundo do OSM e mapa carregado sob demanda. Verificar relendo os trechos

## 6. Verificação integrada

- [x] 6.1 Rodar `npm test`, `npm run lint` e `npm run build` em `web/` e conferir que o mapa ficou num pedaço separado na saída do build
- [x] 6.2 Com a API e o dev server no ar, conferir os três recortes em 1440 e 420 px:
  - cores e legenda;
  - dica;
  - clique para Convênios;
  - filtro com municípios apagados;
  - fundo atenuado com o crédito;
  - mapa com contornos mesmo bloqueando `tile.openstreetmap.org`.
  
  Capturas só no scratchpad.

## Workflow follow-up

- Arquivar a change com `/opsx:archive` depois da revisão e do commit pedido pelo usuário.
