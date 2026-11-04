# Spec Delta

## ADDED Requirements

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
