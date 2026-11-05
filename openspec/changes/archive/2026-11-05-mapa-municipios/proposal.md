# Proposal

## Why

A tela Municípios mostra o ranking só em tabela. Assim, não dá para ver de relance onde os convênios do recorte se concentram no estado, nem quais regiões ficam de fora. Um mapa do RJ, com cada município colorido pela quantidade de convênios do recorte, responde a isso, e a tabela continua logo abaixo para os valores.

## What Changes

- **Mapa coroplético na tela Municípios**, acima da tabela e ocupando a largura toda:
  - mostra os 92 municípios do RJ pelo contorno, sobre o mapa de fundo do OpenStreetMap, com o crédito visível;
  - cada município recebe a cor da sua faixa de quantidade de convênios no recorte selecionado, numa escala de um só matiz, do claro ao escuro;
  - município sem convênio no recorte fica cinza, separado da faixa mais baixa;
  - a legenda lista as faixas, que se ajustam ao recorte (os Vigentes têm poucos convênios por município, o Histórico inicial tem muitos).
- **Interação**: ao passar o mouse, o município é destacado e uma dica mostra o nome e a quantidade de convênios. O clique abre a tela Convênios filtrada por aquele município, mantendo o recorte e o mês, como a linha da tabela já faz.
- **Filtro de município**: com municípios selecionados, os demais continuam no mapa, mas apagados.
- **Contornos dos municípios**: arquivo GeoJSON do RJ, gerado a partir da malha pública do IBGE, simplificado e versionado no `web/`, com o nome oficial de cada município. É dado geográfico público, não dado de convênio. Um script do `web/` regera o arquivo.
- **Dependências novas no `web/`**: `leaflet` e `react-leaflet`. O mapa é carregado sob demanda, para não pesar nas outras telas.
- Sem mudança na API: a quantidade de convênios por município já vem de `/painel/municipios`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `painel-web`: novo requisito para o mapa de convênios por município na tela Municípios (cores por faixa, legenda, dica, clique para Convênios, filtro de município, fundo do OpenStreetMap).

## Impact

- `web/src/telas/Municipios.tsx`: o mapa entra entre o cabeçalho e a tabela.
- Módulos novos no `web/` para o mapa e para a lógica pura de junção por nome e de faixas, mais o GeoJSON e o script que o gera.
- `web/src/api/hooks.ts`: a consulta de todos os municípios do recorte (já usada no seletor) passa a servir também o mapa.
- `web/package.json`: `leaflet`, `react-leaflet` e os tipos do Leaflet.
- Rede: o navegador passa a buscar o mapa de fundo em `tile.openstreetmap.org`. Isso exige acesso à internet, que o usuário confirmou existir; sem ele, o mapa mostra só os contornos.
- Docs: `web/README.md` e `CLAUDE.md` (tela Municípios e origem dos contornos).
