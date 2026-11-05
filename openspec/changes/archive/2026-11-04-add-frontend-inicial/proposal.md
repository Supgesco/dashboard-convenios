# Proposal

## Why

A API do painel e das cargas está pronta e aceita: resumo, série, ranking, lista, detalhe do convênio, status e histórico de cargas. Mas ainda não existe interface, e quem acompanha os convênios precisa ler JSON no `/docs`. Esta change cria o front-end inicial em `web/` (planejado no `CLAUDE.md` e no `.gitignore`) sobre esses endpoints, sem mudar o back-end.

## What Changes

- **Novo app web em `web/`**, em React + Tailwind CSS (com TypeScript e Vite), com cinco telas:
  - **Visão geral** (`/painel/resumo` + `/painel/serie`):
    - cards dos 4 saldos SIAFE com a variação sobre o mês anterior;
    - o bloco contratual nos recortes 31/89 e, no 342, a contagem por status e situação da vigência;
    - o gráfico da série mensal;
    - a cobertura (vinculado × total SIAFE), só sem filtro de município;
    - as datas das últimas cargas.
  - **Municípios** (`/painel/municipios`): ranking paginado e ordenável pelo cabeçalho, com a marca de código compartilhado. O clique na linha abre a lista de convênios filtrada pelo município.
  - **Convênios** (`/painel/convenios`): lista paginada e ordenável. O clique na linha abre o detalhe.
  - **Detalhe do convênio** (`/painel/convenio`):
    - identificação, recortes e convênios com código compartilhado;
    - saldos do mês e do mês anterior;
    - um bloco contratual por aba;
    - o gráfico da série do convênio.
  - **Cargas** (`/etl/siafe/status`, `/etl/siafe/execucoes`, `POST /etl/siafe`):
    - a última carga SIAFE e o histórico paginado;
    - um botão de disparo com confirmação explícita. A tela avisa que cada carga faz login no SIAFE e trata o 409 de carga em andamento;
    - enquanto a carga está em andamento, a tela consulta o status a cada 5 s;
    - mostra a última importação da planilha, sem upload.
- **Filtros globais** (recorte, municípios, mês de referência) numa barra comum às telas do painel, guardados na URL: recarregar ou compartilhar o link mantém a mesma visão.
  - O seletor de municípios usa `/painel/municipios?tamanho=100`.
  - Sem mês na URL, a tela usa o `ultimo_mes_disponivel` do resumo, não o mês corrente.
- **Regras de exibição**:
  - valor ausente aparece como "—", nunca como 0;
  - valores em reais e percentuais no formato pt-BR;
  - erros da API (422, 404, falha de rede) aparecem como mensagem na tela, não como página em branco.
- **Desenvolvimento**: um proxy do servidor de desenvolvimento encaminha `/api` para a API local. Por isso a API não ganha CORS.
- **Documentação**: `web/README.md` (como rodar, a variável do endereço da API, o aviso de rede interna) e o `CLAUDE.md`, que deixa de dizer que não há front-end.

Fora do escopo:
- autenticação, mantendo a decisão anterior: a API e o front ficam na rede interna;
- upload e histórico da planilha;
- mudanças na API, inclusive CORS;
- build de produção servido pela API, deploy e Docker;
- exportação para CSV/Excel, impressão e mapas.

## Capabilities

### New Capabilities
- `painel-web`: a interface web do painel. Cobre as telas, a navegação entre elas, os filtros na URL, as regras de exibição de valores e o acompanhamento e disparo de cargas.

### Modified Capabilities
<!-- Nenhuma: o front consome os endpoints como estão especificados em painel-gerencial e siafe-ingestion. -->

## Impact

- **Código novo**: `web/`, um projeto Node independente do `api/`, com o próprio `package.json` e o lockfile do npm.
- **API**: nenhuma mudança. O front depende dos contratos das specs `painel-gerencial` e `siafe-ingestion`.
- **Dependências novas** (só em `web/`): React, React Router, TanStack Query, Recharts, Tailwind CSS, Vite, TypeScript, openapi-typescript (tipos gerados do OpenAPI da API), Vitest e Testing Library.
- **Testes**: testes do front com respostas sintéticas da API (sem chamar a API real nem usar dados reais), mais `tsc` e o build rodando sem erro.
- **Dados**: o front não grava nada. Nenhum dado real entra no repositório, nem como fixture nem como captura de tela.
- **Documentação**: `web/README.md` e `CLAUDE.md`.
