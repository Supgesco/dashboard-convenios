# Tasks

## 1. Modelo de dados e configuração (API)

- [x] 1.1 Adicionar `Usuario` e `Sessao` em `app/models.py` e a migração `0005_cria_usuario_e_sessao.py` (índice único em `lower(email)`, FK com `ON DELETE CASCADE`). Verificar com `alembic upgrade head` seguido de `alembic check` sem diferenças, num banco de teste.
- [x] 1.2 Adicionar `sessao_horas` (padrão 12) e `sessao_cookie_seguro` (padrão `true`) em `Settings` e cobrir os padrões em `tests/test_config.py`.
- [x] 1.3 Incluir `usuario` e `sessao` no `TRUNCATE` e na trava "banco com dados" do `tests/conftest.py`. Verificar que `uv run pytest` continua passando.

## 2. Núcleo de autenticação (API)

- [x] 2.1 Criar `app/auth/senha.py` (hash e verificação com scrypt, hash fictício para e-mail inexistente) com testes unitários sem banco: hash correto e errado, sal diferente para a mesma senha, formato inválido recusado.
- [x] 2.2 Criar `app/auth/servico.py` com as operações sobre o banco: autenticar (com contagem de falhas e bloqueio de 5 erros / 15 min), abrir, buscar e encerrar sessão, criar usuário, trocar senha, ativar e desativar. Escrever testes de integração em `tests/test_auth_servico.py` cobrindo os cenários de bloqueio, expiração, desativação que derruba sessões e token que não aparece no banco.
- [x] 2.3 Criar `app/auth/dependencias.py` (`usuario_atual`: cookie → sessão válida de usuário ativo, 401/503) e verificar a dependência pelos testes do grupo 3.

## 3. Endpoints e proteção das rotas (API)

- [x] 3.1 Criar `app/routers/auth.py` (`POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, cookie `convenios_sessao`) e registrá-lo em `app/main.py`. Escrever testes em `tests/test_routers_auth.py`: login 200 com cookie, sem hash no corpo; 401 idêntico para senha errada, e-mail inexistente e usuário inativo; 429 no bloqueio; `me` com e sem sessão; logout invalida o cookie.
- [x] 3.2 Aplicar `Depends(usuario_atual)` nos routers `painel` e `etl` em `app/main.py`. Acrescentar o override de usuário nas fixtures de `test_routers_painel.py` e `test_routers_etl.py`, e incluir testes de 401 sem sessão para `GET /painel/resumo` e `POST /etl/siafe` (este sem iniciar carga). Verificar que `uv run pytest` passa completo.

## 4. CLI de usuários (API)

- [x] 4.1 Criar `app/auth/usuarios.py` (`python -m app.auth.usuarios criar|senha|ativar|desativar|listar`, senha por `getpass` ou `--senha-stdin`, mínimo de 8 caracteres) com testes em `tests/test_auth_cli.py`: criar, duplicado (código 1), senha curta (código 1, nada gravado), desativar derruba sessões e listagem sem hash.
- [x] 4.2 Atualizar `api/README.md` (endpoints `/auth`, variáveis `SESSAO_*`, uso da CLI, remover o aviso "a API não tem autenticação") e verificar que os comandos documentados rodam como estão escritos.

## 5. Front autenticado pela API

- [x] 5.1 Em `src/api/cliente.ts`, adicionar `credentials: 'same-origin'` e o ouvinte `aoNaoAutenticado` (chamado em 401 fora de `/auth/*`), com testes em `cliente.test.ts`.
- [x] 5.2 Reescrever `src/autenticacao.tsx` sobre a API (`/auth/me` na montagem, login com mensagens de 401/429, logout com `queryClient.clear()`, usuário fixo no modo estático), sem `USUARIOS_PADRAO`, `localStorage`, `loginDemo` nem `EM_TESTE`. Verificar com `grep` que não sobra senha no código de `web/src`.
- [x] 5.3 Ajustar os stubs de teste (`rotasPadrao` com `GET /auth/me` e um fixture de usuário sintético) e os testes que renderizam o `Layout` sem `rotasPadrao`. Reescrever `Login.test.tsx`: campos, login correto navega ao destino, 401 mostra o erro, 429 mostra o bloqueio, e um 401 numa tela leva ao login. Verificar que `npm test` passa completo.
- [x] 5.4 Regenerar `src/api/openapi.json` e `schema.d.ts` com `npm run api:tipos` e verificar com `npm run lint` e `npm run build` sem erros.

## 6. Documentação e integração

- [x] 6.1 Atualizar o `CLAUDE.md` (pacote `app/auth/`, migração `0005`, rotas protegidas, CLI, front sem usuários no código) e as notas de deploy (`deploy/README.md`: criação de usuários depois do primeiro deploy, `SESSAO_*` no `api.env`, autenticação passa a existir).
- [x] 6.2 Verificação ponta a ponta local: com a API (`--port 8010`) e o front (`npm run dev`), criar um usuário de teste pela CLI, entrar, navegar, recarregar mantendo a sessão, sair, e confirmar que `GET /api/painel/resumo` sem cookie responde 401. Depois remover o usuário de teste.

## Workflow follow-up

- Depois do deploy, criar a conta `denise.castro@obras.rj.gov.br` no servidor pela CLI (a senha é digitada no terminal, nunca vai para o git).
- Arquivar a mudança (`/opsx:archive`) depois de revisada e publicada.
