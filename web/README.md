# Web — Painel de convênios

Front-end do painel em React + TypeScript + Tailwind CSS (Vite). Ele só lê a API em `../api`; a única escrita é o disparo da carga SIAFE na tela Cargas.

Telas:

| Endereço | Tela | Endpoints |
|---|---|---|
| `/` | Visão geral da carteira, sem filtros: totais de cadastrados (342) e vigentes (31), valores contratuais dos vigentes, rosca de status (os 5 mais frequentes + "Outros", `src/rosca.ts`; "Vigente" é estar nos 31, e quem a planilha marca como Vigente fora deles, que a API conta como "Vigência não confirmada", entra sempre em "Outros"), top 10 municípios e lista dos vigentes | `/painel/resumo`, `/painel/municipios`, `/painel/convenios` |
| `/municipios` | Ranking de municípios | `/painel/municipios` |
| `/convenios` | Cards dos 4 saldos SIAFE do filtro e lista de convênios | `/painel/resumo`, `/painel/convenios` |
| `/convenio?numero=&municipio=` | Detalhe de um convênio | `/painel/convenio` |
| `/cargas` | Última carga, histórico e disparo | `/etl/siafe/status`, `/etl/siafe/execucoes`, `POST /etl/siafe` |

Os filtros (`recorte`, `municipio` repetível, `ano`/`mes`, `pagina`, `ordem`) ficam na URL. Sem `ano`/`mes`, as telas com filtro usam o último mês com dados do SIAFE. A Visão geral ignora recorte, município e mês (só lê `pagina` e `ordem` da lista dos vigentes), mas os mantém na URL para as outras telas.

As telas ficam à direita de uma barra lateral de navegação. Em telas estreitas, a barra lateral vira uma gaveta aberta pelo botão "Menu". Municípios e Convênios têm uma barra de filtros compacta no topo (em tela larga, quando ela sai da tela ao rolar, fica presa no topo como um cabeçalho): recorte num seletor segmentado, municípios numa lista com busca (os escolhidos viram chips removíveis) e o mês de referência.

Os recortes aparecem pelo nome, do maior para o menor (cada um está contido no anterior), e a URL continua usando o número:

| URL | Nome na tela |
|---|---|
| `recorte=342` | Histórico inicial |
| `recorte=89` | Primeiro realinhamento |
| `recorte=31` | Vigentes (padrão) |

A quantidade de convênios ao lado de cada nome vem da API, e não fica no código. É o `convenios` de `GET /painel/resumo?recorte=…` sem município nem mês, e não muda com o filtro de município. O 342 reaproveita o pedido que as telas já fazem para o mês padrão. Se a contagem falhar, o seletor mostra só o nome.

As cores ficam em `src/index.css` (tokens `gelo` e `marca`). As das séries do gráfico ficam em `src/series.ts`, validadas com o validador de paleta da skill de dataviz.

> **A API não tem autenticação, e o botão de carga faz login no SIAFE.** Logins repetidos já bloquearam temporariamente o IP desta máquina. Rode a API e o front só na rede interna. O servidor de desenvolvimento escuta apenas em `localhost`; não use `--host`.

## Requisitos

- Node 24 e npm.
- A API rodando (veja `../api/README.md`); para `npm run api:tipos`, também o `uv`.

## Uso

```bash
npm install
npm run dev          # http://localhost:5180, com /api encaminhado para a API
```

Em outro terminal, a partir de `../api`: `uv run fastapi dev app/main.py --port 8010`.

As portas são próprias deste projeto (8010 e 5180), fora das padrão 8000 e 5173, que costumam estar ocupadas por outros projetos. O `npm run dev` falha se a 5180 estiver em uso, em vez de subir em outra porta sem avisar. Se a tela mostrar "A resposta não veio da API do painel", o proxy está falando com outro serviço: confira a porta da API e o `API_URL`.

| Variável | Onde | Padrão | Uso |
|---|---|---|---|
| `API_URL` | ambiente do `npm run dev` | `http://localhost:8010` | destino do proxy `/api` (o prefixo é retirado) |
| `VITE_API_BASE` | build/dev | `/api` | base das chamadas feitas pelo navegador |

Exemplo com a API em outra porta: `API_URL=http://localhost:8765 npm run dev`. A API não tem CORS: no desenvolvimento, as chamadas passam pelo proxy do Vite.

## Tipos da API

`src/api/openapi.json` e `src/api/schema.d.ts` são gerados do OpenAPI da API (sem banco) e versionados:

```bash
npm run api:tipos
```

Rode sempre que um modelo de resposta da API mudar; o `tsc` passa a apontar os usos quebrados. Os dois arquivos não podem ser editados à mão.

## Testes e verificação

```bash
npm test             # Vitest + Testing Library (jsdom)
npx tsc -b           # tipos
npm run build        # build de produção em dist/
npm run lint         # oxlint
```

Os testes usam respostas sintéticas da API (`src/teste/fixtures.ts`) e um stub de `fetch` por rota (`src/teste/api.ts`); nenhum teste chama a API real. Não versione dados reais nem capturas de tela das telas com dados reais.
