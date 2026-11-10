# Proposta

## Why

O login atual existe só no front. Os usuários e as senhas estão fixos em `web/src/autenticacao.tsx` e vão no JavaScript publicado, então qualquer pessoa que abra o site consegue lê-los. A "sessão" é um objeto no `localStorage` que pode ser forjado, e a API responde a qualquer cliente. Agora que o painel está publicado em `subtsi.obras.rj.gov.br/convenios` e precisamos dar acesso a pessoas específicas (a primeira é denise.castro@obras.rj.gov.br), o login tem de ser verificado no servidor, contra o banco.

## What Changes

- Novas tabelas no Postgres: `usuario` (e-mail único, nome, cargo, órgão, perfil, hash da senha, ativo, controle de tentativas) e `sessao` (hash do token, usuário, criação, expiração).
- Novos endpoints `POST /auth/login`, `GET /auth/me` e `POST /auth/logout`. A sessão é um token opaco num cookie `HttpOnly`.
- Bloqueio temporário da conta depois de tentativas seguidas de senha errada.
- **BREAKING**: todas as rotas `/painel/*` e `/etl/*` passam a exigir sessão válida e respondem 401 sem ela.
- Nova CLI para administrar usuários no servidor (criar, trocar senha, ativar, desativar, listar). A senha é lida sem eco e nunca vai como argumento de linha de comando. É assim que a conta da Denise será criada, sem senha no git.
- Front: `autenticacao.tsx` passa a usar a API. Saem os usuários e senhas do código, o `localStorage` e o `loginDemo`. Ao abrir o app, ele confere a sessão em `/auth/me`. Qualquer 401 da API leva de volta ao login, e o "Sair" encerra a sessão no servidor.
- Os tipos da API (`openapi.json`, `schema.d.ts`) são regenerados. A documentação (`api/README.md`, `CLAUDE.md`, notas de deploy) deixa de dizer que a API não tem autenticação e passa a explicar como criar usuários.

## Capabilities

### New Capabilities
- `autenticacao`: contas de usuário no banco, login e logout com sessão no servidor, proteção das rotas da API e o comportamento do app web diante da sessão (entrar, sair, sessão expirada).

### Modified Capabilities
<!-- Nenhuma: login e proteção de rotas não constam das specs atuais; o comportamento novo fica todo em `autenticacao`. -->

## Impact

- **API**: `app/models.py`, a nova migração `0005`, o novo pacote `app/auth/` (senha, sessão, dependência FastAPI, CLI), o novo router `app/routers/auth.py`, `app/main.py` (a dependência de sessão nos routers `painel` e `etl`) e `app/config.py` (duração da sessão, cookie `Secure`). Não há dependência nova: o hash usa o `scrypt` da biblioteca padrão.
- **Testes da API**: o `conftest.py` passa a incluir `usuario`/`sessao` na limpeza e na trava de segurança "banco com dados". As fixtures dos testes de router existentes sobrescrevem a dependência de sessão, e há testes novos para senha, login, logout, bloqueio e rotas protegidas.
- **Web**: `src/autenticacao.tsx`, `src/api/cliente.ts` (aviso de 401), `src/telas/Login.tsx` e seus testes, e os stubs de `fetch` em `src/teste/` (que passam a responder `/auth/me`). O modo estático, que não tem API, segue sem login.
- **Operação**: depois do deploy, ninguém acessa o painel até existir um usuário criado pela CLI no servidor. O fallback para dados locais quando o Postgres está fora do ar deixa de servir o painel, porque a sessão é verificada no banco.
