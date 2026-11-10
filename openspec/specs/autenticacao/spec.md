# autenticacao Specification

## Purpose

Controla quem acessa o painel de convênios: contas de usuário guardadas no banco, login e logout com sessão verificada no servidor, proteção de todas as rotas de dados da API e o comportamento do app web diante da sessão.

## Requirements

### Requirement: Contas de usuário no banco
O sistema SHALL guardar cada usuário no banco com e-mail (único, sem diferenciar maiúsculas e minúsculas), nome, cargo, órgão, perfil (`administrador`, `analista` ou `auditor`) e situação ativa ou inativa. A senha MUST ser guardada só como hash com sal, nunca em texto puro nem de forma reversível.

#### Scenario: Senha nunca guardada em claro
- **WHEN** um usuário é criado com a senha `Exemplo@123`
- **THEN** nenhuma coluna do banco contém o texto `Exemplo@123`, e dois usuários com a mesma senha ficam com hashes diferentes

#### Scenario: E-mail sem diferenciar caixa
- **WHEN** existe o usuário `fulano@obras.rj.gov.br` e alguém tenta criar `Fulano@Obras.RJ.gov.br`
- **THEN** a criação é recusada por e-mail já cadastrado

### Requirement: Administração de usuários pela linha de comando
O sistema SHALL oferecer uma CLI, executada no servidor da API, para criar usuários, trocar a senha, ativar, desativar e listar usuários. A senha MUST ser lida do terminal sem eco (ou da entrada padrão) e MUST NOT ser aceita como argumento de linha de comando. Senhas com menos de 8 caracteres MUST ser recusadas. A listagem MUST NOT mostrar hashes.

#### Scenario: Criar usuário
- **WHEN** o operador cria `denise.castro@obras.rj.gov.br` com nome e perfil e digita a senha duas vezes iguais
- **THEN** o usuário passa a existir, ativo, e consegue fazer login com essa senha

#### Scenario: Senha curta recusada
- **WHEN** o operador informa uma senha de 7 caracteres
- **THEN** a CLI recusa, sai com código diferente de zero e nada é gravado

#### Scenario: Desativar encerra as sessões
- **WHEN** o operador desativa um usuário que tem sessões abertas
- **THEN** o usuário não consegue mais fazer login, e as sessões que ele tinha deixam de valer

### Requirement: Login com e-mail e senha
`POST /auth/login` SHALL receber e-mail e senha. Com credenciais corretas de um usuário ativo, SHALL responder 200 com os dados públicos do usuário (id, e-mail, nome, cargo, órgão, perfil) e abrir uma sessão. E-mail inexistente, senha errada e usuário inativo MUST receber a mesma resposta 401, com a mesma mensagem, sem revelar qual foi o caso. O e-mail SHALL ser comparado sem espaços nas pontas e sem diferenciar caixa.

#### Scenario: Login correto
- **WHEN** um usuário ativo envia o e-mail e a senha corretos
- **THEN** a API responde 200 com seus dados públicos, sem nenhum hash ou token no corpo, e define o cookie de sessão

#### Scenario: Credenciais inválidas
- **WHEN** alguém envia uma senha errada, ou um e-mail que não existe, ou as credenciais de um usuário inativo
- **THEN** a API responde 401 com a mensagem "E-mail ou senha inválidos." nos três casos e não define cookie

### Requirement: Bloqueio após tentativas erradas
Depois de 5 senhas erradas seguidas para um mesmo usuário, o login dessa conta SHALL ficar bloqueado por 15 minutos e responder 429, mesmo com a senha correta. Um login bem-sucedido SHALL zerar a contagem.

#### Scenario: Conta bloqueada
- **WHEN** a senha de um usuário é errada 5 vezes seguidas e, em seguida, é enviada a senha correta
- **THEN** a API responde 429 e não abre sessão

#### Scenario: Bloqueio expira
- **WHEN** passam 15 minutos desde o bloqueio e o usuário envia a senha correta
- **THEN** o login funciona e a contagem de erros volta a zero

### Requirement: Sessão em cookie protegido
A sessão SHALL ser identificada por um token aleatório entregue num cookie `HttpOnly`, `SameSite=Lax`, e `Secure` exceto quando desativado na configuração para desenvolvimento. O banco MUST guardar só um hash do token. A sessão SHALL expirar após um prazo configurável (padrão 12 horas). Depois disso, ela não vale mais.

#### Scenario: Token não fica legível no banco
- **WHEN** uma sessão é aberta
- **THEN** o valor do cookie não aparece em nenhuma coluna do banco

#### Scenario: Sessão expirada
- **WHEN** uma requisição usa o cookie de uma sessão cujo prazo já passou
- **THEN** a API trata a requisição como não autenticada

### Requirement: Usuário da sessão atual
`GET /auth/me` SHALL responder 200 com os dados públicos do usuário da sessão válida, ou 401 sem sessão válida.

#### Scenario: Com sessão
- **WHEN** um cliente com sessão válida chama `GET /auth/me`
- **THEN** recebe 200 com seu id, e-mail, nome, cargo, órgão e perfil

#### Scenario: Sem sessão
- **WHEN** um cliente sem cookie, ou com cookie inválido, chama `GET /auth/me`
- **THEN** recebe 401

### Requirement: Logout
`POST /auth/logout` SHALL encerrar no servidor a sessão do cookie enviado e apagar o cookie. A resposta SHALL ser de sucesso mesmo quando não há sessão.

#### Scenario: Sair
- **WHEN** um usuário com sessão chama `POST /auth/logout` e depois usa o mesmo cookie em `GET /auth/me`
- **THEN** o logout tem sucesso e o `GET /auth/me` seguinte responde 401

### Requirement: Rotas da API protegidas
Todas as rotas `/painel/*` e `/etl/*`, de leitura e de escrita, MUST exigir sessão válida de usuário ativo e responder 401 sem ela, antes de ler ou alterar qualquer dado. Desativar o usuário MUST invalidar suas sessões. As rotas `/auth/login`, `/auth/logout` e a documentação da API ficam acessíveis sem sessão.

#### Scenario: Leitura sem sessão
- **WHEN** um cliente sem sessão chama `GET /painel/resumo`
- **THEN** recebe 401 e nenhum dado de convênio

#### Scenario: Disparo de carga sem sessão
- **WHEN** um cliente sem sessão chama `POST /etl/siafe`
- **THEN** recebe 401 e nenhuma carga é iniciada

#### Scenario: Com sessão
- **WHEN** um usuário com sessão válida chama `GET /painel/resumo`
- **THEN** recebe a mesma resposta que a rota dava antes desta mudança

### Requirement: App web autenticado pela API
O app web SHALL verificar a sessão na API ao abrir e mostrar a tela de login quando não houver sessão, voltando depois do login ao endereço que o usuário tentou abrir. O app MUST NOT conter usuários ou senhas no código entregue ao navegador nem guardar dados de sessão no armazenamento do navegador. Qualquer 401 da API SHALL levar à tela de login. O botão "Sair" SHALL encerrar a sessão na API.

#### Scenario: Abrir sem sessão
- **WHEN** alguém sem sessão abre o endereço da tela Convênios
- **THEN** o app mostra o login e, após um login correto, abre a tela Convênios

#### Scenario: Credenciais erradas
- **WHEN** o usuário envia uma senha errada na tela de login
- **THEN** a tela mostra a mensagem de erro da API e continua no login

#### Scenario: Conta bloqueada
- **WHEN** a API responde 429 ao login
- **THEN** a tela informa que a conta está temporariamente bloqueada por excesso de tentativas

#### Scenario: Sessão expira durante o uso
- **WHEN** o usuário está numa tela e a API passa a responder 401
- **THEN** o app volta para a tela de login

#### Scenario: Recarregar mantém a sessão
- **WHEN** um usuário logado recarrega a página
- **THEN** continua logado, sem digitar a senha de novo, enquanto a sessão for válida
