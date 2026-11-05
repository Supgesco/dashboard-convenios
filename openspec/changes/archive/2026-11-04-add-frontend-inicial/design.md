# Design

## Context

Motivação e escopo: ver proposal.md. Requisitos: ver `specs/painel-web/spec.md`.

O que já existe e molda a abordagem:
- A API (`api/app/main.py`) monta os routers na raiz, em `/painel/*` e `/etl/*`, sem prefixo `/api` e sem CORS. Ela não tem autenticação e deve ficar na rede interna.
- Os contratos de resposta são modelos Pydantic em `app/routers/painel.py` (`Resumo`, `Serie`, `Municipios`, `Convenios`, `DetalheConvenio`) e `app/routers/etl.py` (`ExecucaoStatus`, `Execucoes`, `ExecucaoIniciada`). O FastAPI publica todos no `/openapi.json`, que pode ser gerado sem banco com `app.openapi()`.
- Regras da API em que o front se apoia:
  - nulo significa "sem dado";
  - `siafe` vem `null` quando o mês não tem dados, e `referencia.ultimo_mes_disponivel` diz qual é o último mês carregado;
  - listas paginadas com `pagina`, `tamanho` (até 100) e `ordem=[-]campo`, de uma whitelist por endpoint, e devolvem `total`;
  - 422 traz `detail` como texto ou objeto `{msg, ...}`;
  - `GET /etl/siafe/status` dá 404 sem cargas, e `POST /etl/siafe` dá 409 com `{detail, execucao_id}`.
- A última importação da planilha (`arquivo`, `planilha_importada_em`) só aparece em `/painel/resumo` → `referencia`.
- O `.gitignore` já cobre `node_modules/`, `web/dist/` e `.vite/`. Na máquina há Node 24 e npm 11, sem pnpm.

## Goals / Non-Goals

**Goals:**
- Um projeto `web/` que roda com `npm install` e `npm run dev`, ao lado da API local, sem mudar nada em `api/`.
- Tipos do front derivados do OpenAPI da API, para que uma mudança de contrato quebre o `tsc` em vez de quebrar a tela em silêncio.
- Testes que rodem sem API, sem banco e sem dados reais.

**Non-Goals:**
- Build de produção servido por um servidor real, Docker, deploy.
- Design system ou biblioteca de componentes. O Tailwind fica com componentes próprios e pequenos.
- Responsividade para celular além do básico (tabelas com rolagem horizontal).
- Internacionalização: tudo em pt-BR.

## Decisions

### 1. Vite + React + TypeScript, com npm, em `web/`

O projeto parte do template `react-ts` do Vite, com Tailwind CSS v4 pelo plugin `@tailwindcss/vite`, sem `tailwind.config` e sem PostCSS próprio. Usa npm porque é o que existe na máquina, e o `package-lock.json` é versionado.

Alternativa considerada: Next.js. Traz SSR e roteamento por arquivos, que não servem a um painel interno só de leitura que fala com uma API separada.

### 2. Rotas e chave do detalhe em query params

React Router com estas rotas:
- `/` (Visão geral);
- `/municipios`;
- `/convenios`;
- `/convenio?numero=&municipio=`;
- `/cargas`;
- `*` (não encontrado).

O detalhe repete a escolha da API: o número tem barra e a chave é composta. O mês em uso entra como `ano`/`mes` só se estiver na URL.

### 3. O estado dos filtros vive só na URL

Um hook único lê e escreve a URL. Ninguém guarda cópia em `useState` ou contexto. Ele cuida destes parâmetros:
- `recorte`, com padrão 31; valor fora de 31/89/342 vira erro de filtro na tela, sem troca silenciosa;
- `municipio`, repetível como na API;
- `ano`/`mes`;
- `pagina` e `ordem`, por tela.

Ao trocar recorte, município, mês ou ordem, a `pagina` volta para 1. Os links do menu e os cliques de linha (ranking → lista → detalhe) montam a URL a partir dos filtros atuais, e é isso que faz "trocar de tela mantém os filtros". O app não valida os municípios: eles vão para a API como estão, e o 422 dela vira a mensagem de filtro inválido.

Alternativa considerada: um store global (Zustand ou Context) sincronizado com a URL. Seriam duas fontes de verdade para o mesmo dado.

### 4. Dados com TanStack Query sobre um cliente `fetch` fino

- `src/api/cliente.ts` monta a URL a partir de uma base, por padrão `/api`, configurável por `VITE_API_BASE`. Ele serializa parâmetros repetidos (`municipio=a&municipio=b`) e converte respostas não-2xx em `ApiErro { status, detail }`. Um erro de rede vira `ApiErro` com `status` 0.
- Cada endpoint tem um hook (`useResumo`, `useSerie`, `useMunicipios`, `useConvenios`, `useConvenio`, `useStatusCarga`, `useExecucoes`, `useDispararCarga`). A chave de cache é o nome do endpoint mais os parâmetros normalizados.
- Nas listas, `placeholderData: keepPreviousData` evita que a tabela pisque ao paginar ou ordenar.
- Nas consultas, `retry: 1`, e nunca para 4xx. `refetchOnWindowFocus` fica desligado, porque os dados só mudam com uma carga.
- Nada é persistido: o cache do Query vive em memória, sem `persistQueryClient` (requisito de não guardar dados no navegador).

### 5. Tipos gerados do OpenAPI

O script `npm run api:tipos` executa:
- `uv run --directory ../api python -c "...app.openapi()..."`, que gera `web/src/api/openapi.json` sem precisar de banco;
- `openapi-typescript`, que gera `web/src/api/schema.d.ts` a partir desse arquivo.

Os dois arquivos são versionados. Os hooks usam `components["schemas"]["Resumo"]` e semelhantes. Quando a API mudar um modelo, regenerar os tipos aponta pelo `tsc` cada uso quebrado. O schema não tem dado real, só a forma.

Alternativa considerada: tipos escritos à mão, que divergem da API sem aviso. Também consideramos gerar um cliente completo (orval ou openapi-fetch), mas é mais dependência do que oito endpoints pedem.

Isto acrescenta `openapi-typescript` às dependências de desenvolvimento listadas no proposal.

### 6. Mês de referência padrão

Um hook `useMesReferencia` funciona assim:
- se a URL tem `ano`/`mes`, usa os dois;
- senão, faz uma consulta `GET /painel/resumo?recorte=342`, sem filtro e com cache longo, e usa `referencia.ultimo_mes_disponivel`. O último mês é global e não depende de recorte;
- se esse campo vier `null`, não envia mês, e a API cai no mês corrente.

As consultas das telas ficam com `enabled: false` até o mês estar resolvido, para não pedir o mês corrente e logo depois o certo. O mês padrão não é escrito na URL: um link sem mês continua significando "o mais recente".

Alternativa considerada: um endpoint de "último mês". Exigiria mudar a API, e esta change não mexe no back-end.

### 7. Opções do seletor de municípios

O seletor usa `GET /painel/municipios?recorte=<r>&tamanho=100&ordem=municipio`, sem o filtro de municípios, para listar todos os do recorte. A chave de cache é só o recorte. Os municípios selecionados que não estão nas opções continuam marcados e removíveis.

### 8. Formatação num módulo único

`src/formato.ts` usa `Intl.NumberFormat("pt-BR")`:
- `moeda(v)`: `R$ 1.234,56`;
- `percentual(v)`: uma casa decimal;
- `data(v)` e `dataHora(v)`: fuso America/Sao_Paulo;
- `mesAno(ano, mes)`.

Todas devolvem "—" para `null` e `undefined`, e só para eles. A variação dos cards é `(atual − anterior) / |anterior|`, e dá "—" quando um dos dois é nulo ou o anterior é zero. As telas nunca formatam número por conta própria, e essa regra fica testada num lugar só.

### 9. Gráficos com Recharts

São gráficos de linha dos 4 saldos por mês, um na Visão geral e um no detalhe, num componente `GraficoSerie` compartilhado. Os pontos nulos ficam como lacuna (`connectNulls={false}`), coerentes com "nulo não é zero". O eixo Y usa moeda abreviada e o tooltip a moeda completa. Cores, legenda e acessibilidade seguem a skill de dataviz no momento da implementação.

### 10. Cargas: polling condicional e disparo confirmado

- `useStatusCarga` usa `refetchInterval: (q) => q.state.data?.status === "em_andamento" ? 5000 : false`. Quando o status sai de `em_andamento`, o hook invalida `useExecucoes` e o resumo, porque a data da posição SIAFE muda.
- No status, o 404 é tratado como "nenhuma carga", não como erro.
- O disparo usa um modal `<dialog>` com o aviso (login no SIAFE, substituição dos dados) e os botões "Iniciar carga" e "Cancelar". O botão de iniciar fica desabilitado durante a mutation e enquanto o status for `em_andamento`, o que evita clique duplo.
  - 202: invalida o status, que passa a mostrar a carga em andamento e começa o polling;
  - 409: mostra "já existe carga em andamento" e também invalida o status.
- A parte da planilha lê `referencia.arquivo` e `referencia.planilha_importada_em` do mesmo resumo usado no mês padrão.

### 11. Proxy de desenvolvimento

`vite.config.ts` tem `server.proxy["/api"]`, com destino `process.env.API_URL ?? "http://localhost:8010"` e `rewrite` que tira o prefixo `/api`. O servidor de dev fica em `localhost`, sem `--host`, na porta 5180 com `strictPort`. As portas são próprias do projeto porque 8000 e 5173 ficam ocupadas por outros projetos nesta máquina: com elas, o proxy falava com outro serviço e o Vite subia em outra porta sem avisar. Uma resposta que não é JSON da API vira um erro explícito ("a resposta não veio da API do painel"). A API não ganha CORS.

### 12. Testes com Vitest e Testing Library

- `formato.ts` e o hook de filtros da URL têm testes unitários: parse, serialização, `municipio` repetido, recorte inválido e reset da página.
- As telas são testadas com Testing Library em jsdom, com `fetch` substituído por um stub que responde por rota com fixtures sintéticas (municípios reais do RJ, números e valores inventados). As fixtures seguem os tipos gerados, então uma fixture fora do contrato quebra o `tsc`.
- Ficam cobertos: nulo como "—", ordenação pelo cabeçalho, paginação na URL, navegação ranking → lista → detalhe, 404 e 422 no detalhe, polling, 409 e o cancelamento do disparo.
- Nenhum teste chama a API real. A verificação manual contra a homologação é só visual, sem capturas de tela versionadas.

## Risks / Trade-offs

- [Os tipos gerados podem ficar velhos se ninguém rodar `api:tipos`] → o README e o `CLAUDE.md` mandam regenerar ao mudar um modelo da API. Uma task confere que o `openapi.json` versionado é igual ao gerado.
- [O botão de carga sem autenticação dispara logins no SIAFE] → a confirmação explícita e o botão desabilitado durante a carga impedem o clique duplo, e a trava 409 da API impede cargas simultâneas. O aviso de rede interna fica no README do `web/`. Nada impede cargas seguidas de propósito: é um risco aceito até haver auth.
- [O resumo extra do mês padrão é uma consulta a mais na abertura] → ela fica em cache longo e é a mesma que alimenta a parte da planilha na tela Cargas.
- [Com `tamanho=100`, o seletor de municípios depende de haver no máximo 100 municípios por recorte] → o RJ tem 92, então o limite cabe. Se a API devolver `total > itens`, o seletor avisa no console.
- [Dados reais visíveis no navegador durante a verificação manual] → nada de capturas ou HARs no repositório. O app não grava nada no navegador.
- [Tabelas largas, com 4 saldos e 6 valores contratuais] → rolagem horizontal, número e município fixos à esquerda, e valores contratuais só nos recortes 31/89.

## Migration Plan

Não há migração: o `web/` é novo e a API não muda. Para desfazer, basta remover `web/`.
