# siafe-ingestion Specification

## Purpose

Trazer para o banco do dashboard os dados da consulta FlexVision do SIAFE, com cargas sob demanda que substituem integralmente o conjunto anterior e deixam registro auditável de cada execução.

## Requirements

### Requirement: Autenticação no SIAFE
Antes de consultar dados, o sistema SHALL obter um bearer token via `POST {SIAFE_URL}/auth` com corpo JSON `{"usuario": SIAFE_USER, "senha": SIAFE_PASSWORD}` e enviá-lo no cabeçalho `Authorization: Bearer <token>` de todas as consultas seguintes da execução.

#### Scenario: Credenciais válidas
- **WHEN** uma carga é iniciada e o SIAFE aceita as credenciais
- **THEN** o sistema obtém o token e o usa nas consultas FlexVision da mesma execução

#### Scenario: Credenciais inválidas
- **WHEN** o SIAFE recusa a autenticação
- **THEN** a execução termina com status de falha, sem consultar a FlexVision e sem alterar os dados persistidos

### Requirement: Renovação de token expirado
Se uma consulta FlexVision responder 401 durante a execução, o sistema SHALL reautenticar uma única vez e repetir a consulta. Se a nova tentativa também responder 401, a execução MUST falhar.

#### Scenario: Token expira no meio da carga
- **WHEN** uma consulta responde 401 e a reautenticação funciona
- **THEN** a consulta é repetida com o novo token e a carga continua

#### Scenario: 401 persistente
- **WHEN** a consulta responde 401 de novo após a reautenticação
- **THEN** a execução termina com status de falha e os dados anteriores continuam intactos

### Requirement: Período coberto pela carga
Cada execução SHALL consultar `GET {SIAFE_URL}/flexvision-consulta/{SIAFE_CONSULTA}` para a UG `SIAFE_UG`, uma vez por mês, de janeiro de 2023 até o mês corrente inclusive. O mês corrente é calculado no fuso America/Sao_Paulo.

#### Scenario: Execução em novembro de 2026
- **WHEN** a carga é executada em 2026-11-03
- **THEN** o sistema consulta todos os meses de 2023-01 a 2026-11, um pedido por par (ano, mês), 47 no total

#### Scenario: Mês sem dados
- **WHEN** a FlexVision retorna uma lista vazia para algum mês
- **THEN** o mês é tratado como sem registros e a carga continua normalmente

### Requirement: Falhas transitórias do SIAFE
O sistema SHALL repetir com espera crescente, até 3 tentativas, consultas que falham por timeout, erro de conexão ou resposta 5xx/429. Se a última tentativa falhar, a execução MUST falhar.

#### Scenario: Instabilidade momentânea
- **WHEN** uma consulta retorna 503 e a tentativa seguinte retorna 200
- **THEN** a carga continua com os dados da tentativa bem-sucedida

#### Scenario: SIAFE indisponível
- **WHEN** as 3 tentativas de uma consulta falham
- **THEN** a execução termina com status de falha e os dados anteriores continuam intactos

### Requirement: Persistência tipada
Cada registro retornado SHALL ser gravado no Postgres como uma linha com colunas tipadas (datas como data, valores monetários como numérico exato, códigos como texto), junto com o ano, o mês e a UG consultados e o identificador da execução.

#### Scenario: Valores monetários
- **WHEN** a FlexVision retorna um valor monetário
- **THEN** ele é armazenado como numérico exato, sem perda de casas decimais

#### Scenario: Resposta fora do formato esperado
- **WHEN** a resposta de algum mês não tem uma coluna obrigatória ou traz um valor que não converte para o tipo esperado
- **THEN** a execução falha com uma mensagem que identifica o mês e o campo, e os dados anteriores continuam intactos

### Requirement: Overwrite atômico
Uma execução bem-sucedida SHALL substituir integralmente os dados SIAFE persistidos pelos dados recém-extraídos, numa única transação. Até o commit, quem consulta o banco MUST continuar vendo o conjunto anterior completo. Uma execução que falha MUST NOT alterar os dados.

#### Scenario: Recarga bem-sucedida
- **WHEN** uma carga termina com sucesso
- **THEN** a tabela contém exatamente os registros dessa execução e nenhum registro de execuções anteriores

#### Scenario: Falha no meio da carga
- **WHEN** a carga falha depois de extrair parte dos meses
- **THEN** a tabela continua com exatamente os registros da última execução bem-sucedida

### Requirement: Disparo por linha de comando
O sistema SHALL oferecer um comando, executável a partir de `api/` via uv, que roda a carga completa de forma síncrona. O comando MUST sair com código 0 em caso de sucesso e com código diferente de zero em caso de falha.

#### Scenario: Execução manual com sucesso
- **WHEN** o operador executa o comando de carga e ela termina bem
- **THEN** o processo sai com código 0 e informa quantos registros foram carregados

#### Scenario: Execução manual com falha
- **WHEN** a carga falha
- **THEN** o processo sai com código diferente de zero e mostra o motivo da falha

### Requirement: Disparo por HTTP
O sistema SHALL expor `POST /etl/siafe`, que inicia a carga em segundo plano e responde `202 Accepted` com o identificador da execução.

#### Scenario: Disparo aceito
- **WHEN** um cliente chama `POST /etl/siafe` e nenhuma carga está em andamento
- **THEN** a resposta é 202 com o identificador da nova execução, e a carga roda em segundo plano

### Requirement: Uma carga por vez
O sistema MUST permitir no máximo uma carga SIAFE em andamento, seja ela disparada pela CLI ou por HTTP.

#### Scenario: Disparo HTTP concorrente
- **WHEN** `POST /etl/siafe` é chamado com uma carga já em andamento
- **THEN** a resposta é `409 Conflict` com o identificador da execução em andamento, e nenhuma nova carga é iniciada

#### Scenario: CLI concorrente
- **WHEN** o comando de carga é executado com outra carga em andamento
- **THEN** o comando sai com código diferente de zero sem consultar o SIAFE

### Requirement: Registro de execuções
O sistema SHALL registrar cada execução com identificador, origem (CLI ou HTTP), início, fim, status (`em_andamento`, `sucesso`, `falha`), quantidade de registros carregados e mensagem de erro. O registro MUST sobreviver ao rollback da carga.

#### Scenario: Execução com falha fica registrada
- **WHEN** uma carga falha
- **THEN** o registro da execução fica com status `falha`, horário de fim e mensagem de erro, mesmo com os dados revertidos

### Requirement: Consulta de status
O sistema SHALL expor `GET /etl/siafe/status`, que retorna a execução mais recente com os campos do registro de execuções.

#### Scenario: Consulta após carga
- **WHEN** um cliente chama `GET /etl/siafe/status` depois de uma carga
- **THEN** a resposta é 200 com o status, os horários e a quantidade de registros da execução mais recente

#### Scenario: Nenhuma execução ainda
- **WHEN** `GET /etl/siafe/status` é chamado e nenhuma carga foi feita
- **THEN** a resposta é 404

### Requirement: Sigilo de credenciais
As credenciais do SIAFE, o bearer token e a senha do banco MUST NOT aparecer em logs, mensagens de erro, respostas HTTP ou no registro de execuções.

#### Scenario: Falha de autenticação registrada
- **WHEN** a autenticação falha e o erro é registrado
- **THEN** a mensagem contém o status HTTP retornado, mas nem usuário, senha ou token

### Requirement: Histórico de execuções
O sistema SHALL expor `GET /etl/siafe/execucoes`, que lista as execuções de carga com os campos do registro de execuções, da mais recente para a mais antiga. A lista MUST ser paginada com `pagina` (a partir de 1, padrão 1) e `tamanho` (1 a 100, padrão 20) e trazer `pagina`, `tamanho` e `total`. Valores fora dos limites MUST gerar 422. Sem execuções, a resposta MUST ser 200 com lista vazia e `total` 0.

#### Scenario: Mais recentes primeiro
- **WHEN** houve 3 execuções, a última delas em andamento
- **THEN** a resposta lista as 3, começando pela execução em andamento, com `total` 3

#### Scenario: Falha no histórico
- **WHEN** uma das execuções falhou
- **THEN** ela aparece com status `falha`, horário de fim e mensagem de erro, sem credenciais

#### Scenario: Paginação
- **WHEN** houve 25 execuções e a requisição traz `pagina=2`
- **THEN** a resposta tem as 5 execuções mais antigas e `total` 25

#### Scenario: Nenhuma execução
- **WHEN** nenhuma carga foi feita
- **THEN** a resposta é 200 com lista vazia e `total` 0

#### Scenario: Limites inválidos
- **WHEN** a requisição traz `tamanho=0`, `tamanho=101` ou `pagina=0`
- **THEN** a resposta é 422

#### Scenario: Consulta não dispara carga
- **WHEN** um cliente chama `GET /etl/siafe/execucoes`
- **THEN** nenhuma carga é iniciada e o SIAFE não é consultado
