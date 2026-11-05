# Spec Delta

## ADDED Requirements

### Requirement: Identificação no detalhe do convênio
`GET /painel/convenio` SHALL receber `numero` e `municipio`, ambos obrigatórios, e devolver o convênio do cruzamento com essa chave. O número MUST ser normalizado como na carga da planilha, e o município como no filtro do painel. Número em formato inválido ou município não reconhecido MUST gerar 422; chave sem convênio MUST gerar 404. A resposta MUST trazer número, município, fase, status, situação e data final da vigência, objeto, códigos e recortes do convênio.

#### Scenario: Convênio encontrado
- **WHEN** o cruzamento tem o convênio `143/2014`–`Paraty`, de fase realinhado, e a requisição traz `numero=143/2014&municipio=Paraty`
- **THEN** a resposta é 200 com esse número e município, fase `realinhado`, os dados da linha da 342 e os recortes `89` e `342`

#### Scenario: Grafias aceitas
- **WHEN** a requisição traz `numero=143/14&municipio=paraty`
- **THEN** a resposta é a do convênio `143/2014`–`Paraty`

#### Scenario: Mesmo número em outro município
- **WHEN** existem os convênios `010/2020`–`Paraty` e `010/2020`–`Resende`, e a requisição traz `numero=010/2020&municipio=Resende`
- **THEN** a resposta é a do convênio de Resende

#### Scenario: Convênio inexistente
- **WHEN** a requisição traz um número e um município válidos sem convênio com essa chave
- **THEN** a resposta é 404

#### Scenario: Entrada inválida
- **WHEN** a requisição traz `numero=abc`, ou `municipio=Atlantida`, ou omite um dos dois parâmetros
- **THEN** a resposta é 422

### Requirement: Código compartilhado no detalhe do convênio
O detalhe SHALL indicar quando algum código do convênio também pertence a outro convênio do cruzamento e MUST listar esses outros convênios, com número, município e o código compartilhado.

#### Scenario: Código em dois convênios
- **WHEN** o código `900001` é o SEOBRAS de `001/2020`–`Paraty` e de `002/2021`–`Resende`
- **THEN** o detalhe de `001/2020`–`Paraty` indica código compartilhado e cita `002/2021`–`Resende` com o código `900001`

#### Scenario: Sem compartilhamento
- **WHEN** nenhum código do convênio pertence a outro convênio
- **THEN** o detalhe indica que não há código compartilhado e a lista vem vazia

### Requirement: Saldos do convênio no detalhe
O detalhe SHALL trazer os 4 saldos SIAFE do convênio no mês de referência e no mês anterior, somando cada código do convênio uma vez. Um bloco de saldos MUST vir nulo quando o SIAFE não tem linhas naquele mês. Convênio sem código MUST ter os saldos nulos.

#### Scenario: Saldos do mês e do anterior
- **WHEN** a referência é 2026-10 e o SIAFE tem os dois meses
- **THEN** o detalhe traz os saldos de 2026-10 e de 2026-09 do convênio

#### Scenario: Código repetido nos dois tipos
- **WHEN** o convênio tem o mesmo código como SEOBRAS e como SEIOP
- **THEN** o saldo dessa conta entra uma vez só

#### Scenario: Mês sem dados no SIAFE
- **WHEN** a referência é 2026-11 e o SIAFE só tem dados até 2026-10
- **THEN** o bloco de saldos do mês vem nulo

### Requirement: Valores contratuais no detalhe do convênio
O detalhe SHALL trazer os valores contratuais e o percentual de execução de cada aba de recorte em que o convênio está (31 e 89), identificados pelo recorte, com as mesmas regras de soma e de realinhado ou inicial do painel. Convênio que não está na 31 nem na 89 MUST vir sem valores contratuais.

#### Scenario: Convênio nas duas abas
- **WHEN** o convênio está na 31 com valor total 100 e na 89 com valor total 120
- **THEN** o detalhe traz os dois blocos, `31` com 100 e `89` com 120

#### Scenario: Convênio só na 342
- **WHEN** o convênio é de fase histórico
- **THEN** o detalhe vem sem valores contratuais

### Requirement: Série mensal do convênio
O detalhe SHALL trazer, para cada mês carregado no SIAFE, em ordem cronológica, os 4 saldos do convênio, somando cada código uma vez. Um mês sem linhas para os códigos do convênio MUST trazer os saldos nulos.

#### Scenario: Série do convênio
- **WHEN** o SIAFE tem dados de 2023-01 a 2026-10 e o convênio só tem linhas a partir de 2024-03
- **THEN** a série tem um ponto por mês de 2023-01 a 2026-10, com saldos nulos antes de 2024-03

#### Scenario: Convênio sem código
- **WHEN** o convênio não tem código
- **THEN** a série tem um ponto por mês carregado, todos com saldos nulos

## MODIFIED Requirements

### Requirement: Recorte da carteira
Os endpoints `/painel/*`, exceto `/painel/convenio`, SHALL aceitar o parâmetro `recorte`, com os valores `31`, `89` ou `342` e padrão `31`, e SHALL considerar só os convênios do cruzamento que pertencem ao recorte:
- `31`: os de fase vigente;
- `89`: os de fase vigente ou realinhado;
- `342`: todos.

Um valor diferente desses MUST gerar resposta 422.

#### Scenario: Recortes aninhados
- **WHEN** o cruzamento tem 2 convênios vigentes, 3 realinhados e 5 históricos
- **THEN** `/painel/resumo` informa 2 convênios no recorte `31`, 5 no `89` e 10 no `342`

#### Scenario: Linha da aba sem convênio na 342
- **WHEN** a aba 31 tem uma linha cuja chave não existe na 342
- **THEN** essa linha não entra em nenhum recorte do painel

#### Scenario: Recorte inválido
- **WHEN** a requisição traz `recorte=100`
- **THEN** a resposta é 422

### Requirement: Filtro por municípios
Os endpoints `/painel/*`, exceto `/painel/convenio`, SHALL aceitar o parâmetro `municipio`, repetível, e restringir os convênios aos municípios informados. Cada valor MUST ser reconhecido pelos nomes dos 92 municípios do RJ com a normalização da carga da planilha (sem acento, maiúsculas, espaços ou pontuação). Valores não reconhecidos MUST gerar 422 com a lista desses valores. Sem o parâmetro, não há filtro.

#### Scenario: Vários municípios
- **WHEN** a requisição traz `municipio=Paraty&municipio=Resende`
- **THEN** só os convênios de Paraty e de Resende entram nos números

#### Scenario: Grafia sem acento
- **WHEN** a requisição traz `municipio=niteroi`
- **THEN** o filtro usa o município Niterói

#### Scenario: Município inexistente
- **WHEN** a requisição traz `municipio=Paraty&municipio=Atlantida`
- **THEN** a resposta é 422 e o detalhe cita `Atlantida`

#### Scenario: Município sem convênio no recorte
- **WHEN** o município informado é válido, mas não tem convênio no recorte
- **THEN** a resposta é 200, com zero convênios e saldos e valores nulos

### Requirement: Mês de referência
`/painel/resumo`, `/painel/municipios`, `/painel/convenios` e `/painel/convenio` SHALL aceitar `ano` e `mes`, que só podem vir juntos. Sem os dois, o mês de referência MUST ser o mês corrente em America/Sao_Paulo. Se o SIAFE não tem linhas no mês de referência, os saldos MUST vir nulos, e o resumo MUST informar o último mês carregado. O mês não é trocado automaticamente.

#### Scenario: Mês padrão
- **WHEN** hoje é 2026-11-04 e a requisição não traz `ano` nem `mes`
- **THEN** a referência é 2026-11

#### Scenario: Só um dos parâmetros
- **WHEN** a requisição traz `ano=2026` sem `mes`
- **THEN** a resposta é 422

#### Scenario: Mês sem dados no SIAFE
- **WHEN** a referência é 2026-11 e o SIAFE só tem dados até 2026-10
- **THEN** o resumo traz o bloco de saldos nulo e o último mês disponível como 2026-10
