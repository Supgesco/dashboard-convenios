# Tasks

## 1. Estrutura do projeto web

- [x] 1.1 Criar `web/` a partir do template Vite `react-ts` com npm. Adicionar Tailwind CSS v4 (`@tailwindcss/vite`), React Router, TanStack Query e Recharts, e como dev: Vitest, jsdom, Testing Library e openapi-typescript. Verificar que `npm install`, `npm run build` e `npx tsc --noEmit` passam e que `git status` não mostra `node_modules/` nem `dist/`.
- [x] 1.2 Configurar o proxy `/api` → `API_URL` (padrão `http://localhost:8010`; dev server fixo em 5180 com `strictPort`), sem o prefixo, e a base `VITE_API_BASE` (padrão `/api`). Verificar com a API local rodando que `npm run dev` responde `/api/painel/serie` pelo proxy, com o servidor só em localhost.
- [x] 1.3 Criar o script `npm run api:tipos`, que gera `src/api/openapi.json` via `uv run --directory ../api` com `app.openapi()`, sem banco, e `src/api/schema.d.ts` com openapi-typescript. Versionar os dois arquivos. Verificar que rodar o script duas vezes não gera diff e que `schema.d.ts` contém `Resumo`, `DetalheConvenio` e `Execucoes`.

## 2. Base compartilhada: cliente, formatação e filtros

- [x] 2.1 Implementar `src/api/cliente.ts`: base configurável, parâmetros repetidos, `ApiErro {status, detail}` para não-2xx e para erro de rede (`status` 0). Implementar também os hooks TanStack Query de cada endpoint, com os tipos de `schema.d.ts`, sem persistência e sem retry em 4xx. Verificar com testes Vitest (stub de `fetch`) a serialização de `municipio` repetido, o `detail` em texto e em objeto, e o erro de rede.
- [x] 2.2 Implementar `src/formato.ts` (moeda, percentual, data, data e hora em America/Sao_Paulo, mês/ano, variação), em que só `null` e `undefined` viram "—". Verificar com testes unitários: 0 → `R$ 0,00`, `null` → "—", 45.5 → `45,5%`, variação com anterior nulo ou zero → "—".
- [x] 2.3 Implementar o hook de filtros na URL, com `recorte` padrão 31, `municipio` repetível, `ano`/`mes`, `pagina`, `ordem`, o reset da página ao mudar filtro ou ordem, e o recorte inválido marcado como erro. Implementar também o `useMesReferencia` (URL ou `ultimo_mes_disponivel`, sem gravar na URL). Verificar com testes do parse, da serialização, do reset e de que as consultas esperam o mês ser resolvido.

## 3. Layout e componentes comuns

- [x] 3.1 Criar o layout com o menu das 5 telas, que marca a tela atual e cujos links preservam os filtros. Criar também as rotas (inclusive `*` → não encontrado) e a barra de filtros: recorte, seletor de municípios a partir de `/painel/municipios?tamanho=100&ordem=municipio` por recorte, e mês com o mês em uso indicado. Verificar com testes: endereço desconhecido mostra "não encontrado"; trocar de tela mantém o recorte; as opções de municípios mudam com o recorte; recorte inválido ou 422 de município mostra a mensagem com "limpar filtros".
- [x] 3.2 Criar componentes comuns: estado de carregamento, caixa de erro com "tentar de novo" usando o `detail`, `TabelaPaginada` (cabeçalho ordenável que alterna `campo`/`-campo`, só para campos da whitelist, paginação com o total e a página na URL, mensagem de lista vazia, rolagem horizontal) e `GraficoSerie` (4 saldos, nulos como lacuna, seguindo a skill de dataviz). Verificar com testes da tabela (dois cliques → `ordem=a_pagar` e depois `-a_pagar`; 83 itens → 5 páginas) e do erro (o botão refaz a consulta).

## 4. Telas do painel

- [x] 4.1 Implementar a Visão geral:
  - cards dos 4 saldos com a variação;
  - o bloco contratual (31/89) ou a situação (342);
  - a cobertura só sem município;
  - a série e as datas das cargas;
  - o aviso de mês sem dados com o último mês disponível.

  Verificar com testes de fixtures sintéticas: recorte 31 sem filtro, recorte 342, com município (sem cobertura), `siafe` nulo e API fora do ar (menu e filtros ainda utilizáveis).
- [x] 4.2 Implementar a tela Municípios: ranking com a marca de código compartilhado e a explicação; o clique na linha abre Convênios com o município e o mesmo recorte e mês. Verificar com testes da ordenação, da paginação e da navegação para a lista filtrada.
- [x] 4.3 Implementar a tela Convênios: as colunas da spec, com os valores contratuais só em 31/89; o clique na linha abre `/convenio?numero=&municipio=` com o mês em uso. Verificar com testes do valor nulo mostrado como "—" ao lado de zero, da lista vazia e da navegação para o detalhe.
- [x] 4.4 Implementar o Detalhe do convênio:
  - identificação e recortes;
  - os compartilhamentos, com link para cada detalhe;
  - os saldos do mês e do mês anterior;
  - os blocos contratuais rotulados por aba, ou o aviso de que não há;
  - a série.

  Verificar com testes: convênio com os blocos 31 e 89; convênio só da 342; 404 com link para a lista; 422 com o motivo da API; clique num convênio compartilhado.

## 5. Tela de cargas

- [x] 5.1 Implementar o acompanhamento:
  - a última carga (status, origem, início, fim, registros, erro);
  - o histórico paginado;
  - a última importação da planilha a partir do resumo, sem upload;
  - status 404 tratado como "nenhuma carga";
  - polling de 5 s só em `em_andamento`, que ao terminar invalida o histórico e o resumo.

  Verificar com testes usando timers falsos: o polling para no sucesso, a falha mostra o `erro` e a tela sem cargas diz isso.
- [x] 5.2 Implementar o disparo com o modal de confirmação: o aviso de login no SIAFE e de substituição dos dados, o botão desabilitado durante a mutation e em `em_andamento`, e o 409 informado e acompanhado. Verificar com testes: confirmar envia exatamente um `POST`; cancelar não envia nenhum; o 409 mostra a mensagem e passa ao acompanhamento; sem disparo, todas as telas só fazem GET.

## 6. Documentação e verificação integrada

- [x] 6.1 Escrever `web/README.md` (requisitos, `npm install`, `npm run dev` com a API em `localhost:8010`, `API_URL`/`VITE_API_BASE`, `npm run api:tipos` ao mudar a API, testes e o aviso de rede interna sem auth). Atualizar o `CLAUDE.md`: o item `web/` passa a descrever o projeto e os comandos, e o "No front-end code exists yet" sai. Verificar seguindo o README do zero num clone limpo de `web/`.
- [x] 6.2 Verificação integrada: `npm test`, `npx tsc --noEmit` e `npm run build` sem erros; `npm run api:tipos` sem diff; `uv run pytest` na API inalterado. Depois, rodar o front contra a API local apontada para a homologação, só leitura e sem disparar carga, e conferir as 5 telas, os filtros na URL ao recarregar, o mês padrão, a navegação ranking → lista → detalhe e o armazenamento do navegador vazio. Nenhuma captura de tela ou dado real vai para o repositório.

## Workflow follow-up

- Arquivar a change com `/opsx:archive` após a revisão, sincronizando a nova spec `painel-web`.
