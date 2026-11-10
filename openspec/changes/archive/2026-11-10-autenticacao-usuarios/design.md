# Design

## Context

- Front: `web/src/autenticacao.tsx` compara e-mail e senha com um dicionário fixo no código e grava o usuário no `localStorage`. `RotaProtegida` só confere esse objeto. `Login.tsx` completa o e-mail com `@obras.rj.gov.br` e chama `login(email, senha)`. Fora dos testes, `loginDemo` já não é usado por nenhuma tela. Hoje `EM_TESTE` pula o login nos testes.
- API: FastAPI sem autenticação. Os routers `painel` (leitura e o CRUD de convênios) e `etl` usam `get_engine()` por dependência e caem em `dados_locais` quando o banco é SQLite ou falha. As migrações vão até `0004`. Os testes de integração usam `TEST_DATABASE_URL`, e o `conftest.py` aborta se o banco tiver dados.
- Deploy: o nginx serve o front em `/convenios/` e encaminha `/convenios/api/` para `127.0.0.1:8010`. Front e API estão na mesma origem, então um cookie basta, sem CORS.
- O motivo da mudança está em proposal.md (Why), e o comportamento em `specs/autenticacao/spec.md`.

## Goals / Non-Goals

**Goals:**
- Verificar credenciais e sessão no servidor, sem nenhum segredo no bundle do front.
- Não acrescentar dependências: só a biblioteca padrão do Python para hash e token.
- Deixar os testes existentes da API e do front verdes com o mínimo de alteração nas fixtures.

**Non-Goals:**
- Autorização por perfil. Todo usuário autenticado tem o mesmo acesso, e o perfil continua só informativo. Pode vir numa mudança futura.
- Tela de administração de usuários, troca de senha pelo próprio usuário, "esqueci a senha" e SSO/LDAP.
- O formulário "Solicitar acesso" da tela de login, que continua só visual.
- Login no modo estático (`emModoEstatico()`), que não tem API.

## Decisions

### Hash de senha: `hashlib.scrypt` da biblioteca padrão
O hash é guardado como `scrypt$<n>$<r>$<p>$<sal_b64>$<hash_b64>`, com `n=2**15`, `r=8`, `p=1`, sal aleatório de 16 bytes e chave de 32 bytes. A comparação usa `hmac.compare_digest`. Os parâmetros ficam dentro do próprio hash, então dá para aumentá-los depois sem invalidar os hashes antigos.
- *Alternativas*: `argon2-cffi`/`pwdlib` ou `bcrypt`. São boas opções, mas acrescentam uma dependência compilada e o runner do servidor pode estar sem internet. O scrypt é um KDF de memória dura reconhecido e já vem no Python 3.12 com OpenSSL.
- Quando o e-mail não existe, o login calcula o hash contra um hash fictício fixo. Assim o tempo de resposta não revela quais contas existem.

### Sessão: token opaco no banco, entregue em cookie
O token é `secrets.token_urlsafe(32)`, e a tabela `sessao` guarda `sha256(token)` (`token_hash`, chave primária), `usuario_id`, `criada_em` e `expira_em`. Ele vai no cookie `convenios_sessao` com `HttpOnly`, `SameSite=Lax`, `Path=/` e `Secure` conforme a configuração. A validade é absoluta (`SESSAO_HORAS`, padrão 12), sem renovação deslizante.
- *Alternativa*: JWT. Exigiria um segredo novo para administrar e não permite revogar a sessão no logout nem ao desativar o usuário sem uma lista de bloqueio. Com a sessão no banco, o logout e a desativação são um `DELETE`.
- *Cookie em vez de `Authorization: Bearer`*: com `HttpOnly`, um XSS não consegue ler o token, e o front não precisa guardar nada (a spec proíbe o armazenamento do navegador). Contra CSRF, `SameSite=Lax` impede que outro site envie o cookie em POST/PUT/DELETE, e a API só aceita JSON nas escritas.
- `Path=/` funciona em dev (`/api`, pelo proxy do Vite) e em produção (`/convenios/api`).
- `SESSAO_COOKIE_SEGURO` tem padrão `true`. Os navegadores aceitam cookie `Secure` em `http://localhost`, então o desenvolvimento local continua funcionando. Os testes usam `false` porque o `TestClient` fala `http://testserver`.
- As sessões vencidas são apagadas de forma oportunista a cada login bem-sucedido (`DELETE ... WHERE expira_em < now()`), sem job.

### Bloqueio por tentativas
O bloqueio usa as colunas `falhas_consecutivas` e `bloqueado_ate` em `usuario`. Senha errada incrementa o contador, e no 5º erro grava `bloqueado_ate = now() + 15 min` e zera a contagem. Enquanto `bloqueado_ate > now()`, a resposta é 429 sem verificar a senha. Login correto zera tudo. E-mail inexistente não tem contador e responde sempre 401.
- *Alternativa*: limitar por IP. Atrás do nginx seria preciso confiar em `X-Forwarded-For`, e a máquina já teve problema com bloqueio de IP. O bloqueio por conta é suficiente para a escala interna do painel.

### Proteção das rotas: dependência no `include_router`
`app/auth/dependencias.py` define `usuario_atual(request, engine)`. Ela lê o cookie, faz `JOIN sessao/usuario WHERE token_hash = :h AND expira_em > now() AND ativo`, e responde 401 se não achar e 503 se o banco não responder. Em `main.py`, a dependência entra como `app.include_router(painel.router, dependencies=[Depends(usuario_atual)])`, e o mesmo vale para `etl`. Assim nenhuma rota nova desses routers fica aberta por esquecimento, e os routers não mudam.
- A dependência usa o mesmo `get_engine` de `app.routers.etl`, para que os testes que já o sobrescrevem continuem apontando para o banco de teste.
- Os testes de router existentes acrescentam `app.dependency_overrides[usuario_atual] = lambda: USUARIO_TESTE` nas fixtures `api`. Testes novos cobrem as rotas sem override, que devem responder 401.
- *Efeito aceito*: com o Postgres fora do ar, as rotas protegidas respondem 503 em vez de cair em `dados_locais`. Não há como saber quem é o usuário sem o banco.

### Router `/auth`
`app/routers/auth.py` tem os endpoints `POST /auth/login` (corpo JSON `{email, senha}`), `GET /auth/me` e `POST /auth/logout`. Os modelos de resposta usam só campos públicos (`UsuarioPublico`). O e-mail é normalizado com `strip().lower()` na gravação e na busca, e há índice único em `lower(email)`.

### Modelos e migração `0005`
`Usuario` e `Sessao` ficam em `app/models.py` (dentro de `Base.metadata`, então o `alembic check` os vê), e a migração `0005_cria_usuario_e_sessao.py` cria as duas tabelas. `sessao.usuario_id` tem `ON DELETE CASCADE`. Nenhuma view depende dessas tabelas.

### CLI `python -m app.auth.usuarios`
Subcomandos (argparse):
- `criar EMAIL --nome --perfil {administrador,analista,auditor} [--cargo] [--orgao]`
- `senha EMAIL`: troca a senha, apaga as sessões e zera o bloqueio
- `desativar EMAIL`: também apaga as sessões
- `ativar EMAIL`
- `listar`

A senha vem de `getpass` duas vezes ou, com `--senha-stdin`, de uma linha da entrada padrão (para automação). Ela tem no mínimo 8 caracteres e nunca é aceita como argumento. A CLI sai com código `0` em caso de sucesso, `1` em erro de validação ou e-mail duplicado ou inexistente. O banco usado é o `DATABASE_URL` das settings, o mesmo das outras CLIs.

### Front
- `autenticacao.tsx`: na montagem, chama `GET /auth/me` (200 → usuário, 401 → `null`). `login` faz `POST /auth/login` e mapeia 401 e 429 para mensagens. `logout` faz `POST /auth/logout`, limpa o usuário e o cache do TanStack Query (`queryClient.clear()`) para não exibir dados ao próximo usuário. Saem `USUARIOS_PADRAO`, `localStorage`, `loginDemo` e `EM_TESTE`.
- `cliente.ts`: exporta `aoNaoAutenticado(fn)`, um registro de um ouvinte. Quando qualquer resposta 401 chega fora de `/auth/*`, o cliente chama o ouvinte antes de lançar o `ApiErro`. O provedor registra um ouvinte que zera o usuário, e o `RotaProtegida` redireciona com `state.from`, comportamento que já existe. O `fetch` usa `credentials: 'same-origin'` explicitamente.
- No modo estático, o provedor não chama a API e usa um usuário fixo "Visitante (demonstração)". Mantém o comportamento atual da publicação estática, que não tem dados protegidos por servidor.
- Testes: `rotasPadrao()` ganha `'GET /auth/me'`, que responde com um usuário sintético. Os testes de login stubam `POST /auth/login` (200, 401 e 429). Os testes que montam `stubApi` sem `rotasPadrao` e renderizam telas com o `Layout` precisam do stub de `/auth/me`.

## Risks / Trade-offs

- [Depois do deploy, ninguém entra até que o primeiro usuário seja criado] → O procedimento de deploy documenta a criação dos usuários pela CLI no servidor, logo após o `alembic upgrade head`. A conta da Denise é criada assim.
- [Banco fora do ar deixa o painel inacessível (503) em vez de usar dados locais] → É aceito: servir dados sem saber quem pede contraria o objetivo da mudança.
- [`Secure` padrão `true` bloqueia login se alguém servir a API por HTTP fora do localhost] → `SESSAO_COOKIE_SEGURO=false` no `.env` para esse caso, documentado no README da API. Produção é HTTPS.
- [Bloqueio por conta permite que um terceiro bloqueie uma conta de propósito, errando a senha] → O bloqueio é curto (15 min) e o operador zera pela CLI (`senha`). É aceitável para uso interno.
- [O scrypt com `n=2**15` usa cerca de 32 MB e dezenas de ms por login] → O volume de logins é pequeno. Os parâmetros podem ser ajustados sem migração.

## Migration Plan

1. Merge na `main`. O deploy roda `alembic upgrade head`, que cria `usuario` e `sessao`, e reinicia a API.
2. No servidor, criar os usuários com `../venv/bin/python -m app.auth.usuarios criar denise.castro@obras.rj.gov.br --nome "Denise Castro" --perfil analista`, digitando a senha.
3. Rollback: `revert` do commit e novo deploy. As tabelas novas podem ficar (o código antigo as ignora) ou sair com `alembic downgrade 0004`.
