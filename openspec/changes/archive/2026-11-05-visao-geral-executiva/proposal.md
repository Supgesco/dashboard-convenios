# Proposal

## Why

Hoje a Visão geral repete, para um recorte, o que as outras telas já mostram: os 4 saldos SIAFE, o bloco contratual, a cobertura e a série mensal. Falta uma tela de abertura que resuma a carteira inteira de uma vez. Ela deve mostrar quanto foi conveniado nos vigentes, quanto o Estado já investiu, quanto falta repassar, quantos convênios estão cadastrados e em quantos municípios, e como eles se distribuem por status e por município.

## What Changes

- **Visão geral fixa, sem filtros**:
  - **BREAKING**: a tela deixa de seguir a barra de filtros. Ela não lê recorte, município nem mês da URL, e a barra de filtros sai dessa tela.
  - Os filtros da URL continuam valendo nas telas Municípios e Convênios, e passar pela Visão geral pelo menu não os apaga.
- **Cards gerais no topo**:
  - Cadastrados: total de convênios do Histórico inicial, com a quantidade de municípios.
  - Vigentes: total de convênios dos Vigentes, com a quantidade de municípios.
  - Valor total conveniado dos Vigentes.
  - Investido pelo Estado nos Vigentes, com o percentual sobre o valor total conveniado.
  - Saldo a repassar dos Vigentes.
- **Gráfico de convênios por status**: barras horizontais com a contagem por status de todos os convênios cadastrados.
- **Top 10 municípios por quantidade de convênios cadastrados**: gráfico de barras horizontais.
- **Lista dos convênios vigentes**: paginada, ordenada por valor total decrescente. O clique numa linha abre o detalhe.
- **Saem da Visão geral**:
  - os 4 cards de saldo SIAFE e a variação, que passam para a tela Convênios;
  - o bloco contratual do recorte;
  - a contagem por situação da vigência;
  - a cobertura vinculado × total SIAFE;
  - o gráfico da série mensal (o detalhe do convênio mantém o seu).
- **Tela Convênios com cards de saldo**: os 4 saldos SIAFE do recorte, dos municípios e do mês em uso, com a variação sobre o mês anterior, em cards acima da lista.
- **API: percentual do investido sobre o valor total**: um campo novo no bloco contratual (resumo, ranking, lista e detalhe), calculado como quociente de somas. O `execucao_pct` (investido ÷ repasse do Estado) continua igual.
- **Leitura das tabelas**: a exigência de zebra é trocada por linhas separadas por um traço fino. O visual novo, ainda sem commit, já tirou a zebra.
- **Barra lateral**: o subtítulo "SIAFE · Planilha geral" é trocado por um texto que não apresenta a planilha como origem dos convênios.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `painel-web`:
  - a Visão geral passa a ser a visão geral fixa da carteira, sem filtros, com cards gerais, status, top 10 municípios e lista dos vigentes;
  - os filtros globais deixam de incluir a Visão geral;
  - a tela Convênios ganha os cards dos 4 saldos com variação;
  - os cenários de mês padrão e de erro que citavam a Visão geral passam para as telas com filtro;
  - a leitura das tabelas troca a zebra por separadores finos.
- `painel-gerencial`:
  - entra o percentual do investido pelo Estado sobre o valor total, ao lado do percentual de execução.

## Impact

- **API** (`api/`):
  - `app/painel/consultas.py`: a nova coluna em `_SOMA_CONTRATUAIS`, na lista e no detalhe;
  - `app/routers/painel.py`: o campo novo no modelo `Contratual`;
  - testes de consultas e routers do painel;
  - nenhuma migração, porque as views não mudam.
- **Tipos do front**: regenerar `web/src/api/openapi.json` e `schema.d.ts` com `npm run api:tipos`.
- **Front** (`web/src`):
  - `telas/VisaoGeral.tsx` é reescrita;
  - `telas/Convenios.tsx` ganha os cards;
  - `componentes/Layout.tsx` tira `/` das telas com filtro e troca o subtítulo;
  - componentes de barra (status e top 10) reaproveitam o estilo já usado na situação;
  - testes em `telas/painel.test.tsx` e fixtures em `teste/`.
- **Pedidos à API na Visão geral**:
  - os resumos sem filtro dos recortes 342 e 31 já são pedidos pelo seletor de recortes e ficam em cache;
  - entram `/painel/municipios` (342, top 10, e 31 com `tamanho=1` para a contagem) e `/painel/convenios` (31).
- **Docs**: `web/README.md` (o que cada tela mostra) e o `CLAUDE.md`, se a descrição das telas mudar.
- **Dependências**: nenhuma nova.
