# convenios-siafe-cruzamento Specification

## Purpose

Ligar os convênios da planilha às contas correntes do SIAFE, para que o dashboard mostre o saldo mensal de cada convênio e para que a equipe veja, e corrija na planilha, as falhas de vínculo entre as duas fontes.

## Requirements

### Requirement: Convênio identificado pela aba 342
O cruzamento SHALL tratar cada linha da aba 342 Convênios como um convênio, identificado pela chave normalizada número do convênio + município. Linha sem número ou sem município MUST NOT virar convênio. Se a chave se repetir, o convênio MUST ser a primeira dessas linhas na aba, e as demais MUST ser apontadas como falha de vínculo.

#### Scenario: Linha comum da 342
- **WHEN** a 342 tem uma linha com número `143/2014` e município `Paraty`
- **THEN** o cruzamento tem um convênio com essa chave, com o status da 342

#### Scenario: Linha sem número do convênio
- **WHEN** uma linha da 342 tem município, mas o número do convênio é nulo
- **THEN** ela não vira convênio e aparece como falha "chave ausente na 342"

#### Scenario: Chave repetida
- **WHEN** as linhas 10 e 50 da 342 têm a mesma chave
- **THEN** o convênio é o da linha 10, e a linha 50 aparece como falha "chave repetida na 342"

### Requirement: Fase do convênio
Cada convênio SHALL ter uma fase derivada das abas em que sua chave aparece: `vigente` se está na aba 31, `realinhado` se está na 89 e não na 31, e `historico` nos demais casos.

#### Scenario: Convênio presente nas três abas do funil
- **WHEN** a chave do convênio aparece na 342, na 89 e na 31
- **THEN** a fase é `vigente`

#### Scenario: Convênio que saiu no último realinhamento
- **WHEN** a chave aparece na 342 e na 89, mas não na 31
- **THEN** a fase é `realinhado`

#### Scenario: Convênio só do histórico
- **WHEN** a chave aparece apenas na 342
- **THEN** a fase é `historico`

### Requirement: Precedência do código entre as abas do funil
Para cada tipo de código (SEOBRAS e SEIOP), o código do convênio SHALL ser o valor não nulo da aba mais recente do funil em que sua chave aparece, na ordem 31, 89 e 342. As linhas da 31 e da 89 MUST ser ligadas ao convênio pela mesma chave.

#### Scenario: Código só na 342
- **WHEN** o convênio tem SEOBRAS `007783` na 342 e não aparece na 89 nem na 31
- **THEN** o código SEOBRAS do convênio é `007783`

#### Scenario: Aba mais recente prevalece
- **WHEN** a 342 traz SEIOP `210040` e a 89 traz SEIOP `210044` para a mesma chave
- **THEN** o código SEIOP do convênio é `210044`, e `210040` aparece como falha "código divergente"

#### Scenario: Aba recente com código vazio
- **WHEN** a 31 traz SEOBRAS nulo e a 89 traz SEOBRAS `007695` para a mesma chave
- **THEN** o código SEOBRAS do convênio é `007695`

### Requirement: Abas auxiliares como fonte complementar de código
As abas Prestação de Contas, Realinhado sem Execução, Não Realinhado Expirado, Tomada de Contas e Acompanhamento Especial SHALL fornecer um código ao convênio apenas quando nenhuma aba do funil tiver aquele tipo de código preenchido. Um valor dessas abas diferente do código escolhido MUST NOT substituí-lo e MUST ser apontado como falha "código divergente".

#### Scenario: Código recuperado de aba auxiliar
- **WHEN** o convênio não tem SEOBRAS em nenhuma aba do funil, e a Tomada de Contas traz `005512` para a mesma chave
- **THEN** o código SEOBRAS do convênio é `005512`

#### Scenario: Aba auxiliar divergente
- **WHEN** o funil dá ao convênio o SEOBRAS `006100`, e a Prestação de Contas traz `006101`
- **THEN** o código continua `006100`, e `006101` aparece como falha "código divergente" com a aba de origem

### Requirement: Registros mensais das contas do convênio
O cruzamento SHALL expor, para cada convênio, cada linha do SIAFE cuja conta corrente é um de seus códigos, sem agregação: chave do convênio, ano, mês, conta corrente, tipo(s) do código, conta contábil (código e nome) e os 4 saldos como vieram do SIAFE. Linhas com saldo zero MUST ser mantidas. Um código repetido nos dois tipos MUST gerar um registro só por linha do SIAFE.

#### Scenario: Registros de um mês
- **WHEN** em 2026-11 o SIAFE tem, para a conta `210044` (SEIOP do convênio), uma linha da conta contábil 812210101 com R$ 100,00 a pagar e uma da 812210102 com R$ 40,00 a comprovar
- **THEN** o convênio tem dois registros em 2026-11, um por conta contábil, com esses valores

#### Scenario: Histórico mês a mês
- **WHEN** a conta do convênio aparece no SIAFE de 2023-01 a 2026-11
- **THEN** há registros do convênio para cada um desses meses, filtráveis por ano e mês

#### Scenario: Linha com saldo zero
- **WHEN** uma linha do SIAFE da conta do convênio tem todos os saldos zerados
- **THEN** ela aparece entre os registros do convênio

#### Scenario: Código repetido nos dois tipos
- **WHEN** o SEOBRAS e o SEIOP do convênio são os dois `210050`, e o SIAFE tem uma linha dessa conta em 2026-11
- **THEN** o convênio tem um único registro para essa linha, com os dois tipos

#### Scenario: Saldos coerentes com os registros
- **WHEN** os registros do convênio em um mês são somados coluna a coluna
- **THEN** o resultado é igual ao saldo do convênio naquele mês

### Requirement: Saldo mensal por código
Para cada código de cada convênio e cada (ano, mês) carregado do SIAFE em que a conta corrente igual ao código tem linhas, o cruzamento SHALL dar os saldos a pagar, a comprovar, a aprovar e aprovados dessa conta naquele mês, junto com o tipo do código (SEOBRAS ou SEIOP).

#### Scenario: Conta com saldo no mês
- **WHEN** o SIAFE de 2026-11 tem a conta corrente `210044` com R$ 100,00 a pagar, e `210044` é o SEIOP de um convênio
- **THEN** o saldo daquele código em 2026-11 tem R$ 100,00 a pagar, tipo SEIOP

#### Scenario: Conta sem linhas no mês
- **WHEN** o código do convênio não aparece no SIAFE de 2025-03
- **THEN** não há saldo daquele código em 2025-03, o que equivale a saldo zero

### Requirement: Saldo mensal por convênio
O saldo de um convênio num (ano, mês) SHALL ser a soma, coluna a coluna, dos saldos de todos os seus códigos naquele mês, contando uma vez só um código que se repita entre os tipos. Saldos de meses diferentes MUST NOT ser somados entre si, porque cada mês é uma foto do estoque. Convênio sem código não tem saldo.

#### Scenario: Convênio com SEOBRAS e SEIOP
- **WHEN** em 2026-11 o SEOBRAS do convênio tem R$ 50,00 a comprovar e o SEIOP tem R$ 30,00 a comprovar e R$ 20,00 a pagar
- **THEN** o saldo do convênio em 2026-11 é R$ 80,00 a comprovar e R$ 20,00 a pagar

#### Scenario: Mesmo código nos dois tipos
- **WHEN** o SEOBRAS e o SEIOP de um convênio são os dois `210050`
- **THEN** o saldo dessa conta entra uma vez só no saldo do convênio

#### Scenario: Meses independentes
- **WHEN** o convênio tem saldo em 2026-10 e em 2026-11
- **THEN** há um saldo para cada mês, e nenhum deles é a soma dos dois

### Requirement: Contas do SIAFE sem convênio
O cruzamento SHALL listar como falha "conta SIAFE sem convênio" cada conta corrente do SIAFE que não é código de nenhum convênio, com os saldos do último (ano, mês) carregado. Se a conta não tem linhas nesse mês, os saldos MUST vir nulos.

#### Scenario: Conta antiga sem código na planilha
- **WHEN** a conta `005348` existe no SIAFE, e nenhum convênio tem esse código
- **THEN** ela aparece como "conta SIAFE sem convênio" com os saldos do último mês

#### Scenario: Conta presa a código descartado
- **WHEN** a 342 traz SEIOP `210040`, a 89 traz `210044` para a mesma chave, e as duas contas existem no SIAFE
- **THEN** `210040` aparece como "conta SIAFE sem convênio", além da falha "código divergente"

### Requirement: Convênios sem código e códigos ausentes do SIAFE
O cruzamento SHALL listar como falha "convênio sem código" cada convênio sem nenhum código, e como falha "código fora do SIAFE" cada código de convênio que não aparece como conta corrente em nenhum mês carregado do SIAFE.

#### Scenario: Convênio sem código
- **WHEN** um convênio não tem SEOBRAS nem SEIOP em nenhuma aba
- **THEN** ele aparece como "convênio sem código", com chave, fase e status

#### Scenario: Código digitado errado
- **WHEN** o código SEOBRAS de um convênio é `099999`, e essa conta não existe no SIAFE
- **THEN** ele aparece como "código fora do SIAFE"

### Requirement: Código em mais de um convênio
O cruzamento SHALL listar como falha "código em mais de um convênio" cada código escolhido para dois ou mais convênios, com as chaves envolvidas. O saldo da conta MUST continuar aparecendo em cada um desses convênios até a planilha ser corrigida.

#### Scenario: Código repetido
- **WHEN** os convênios `010/2012`–`Resende` e `011/2012`–`Resende` têm os dois o SEOBRAS `007001`
- **THEN** `007001` aparece como "código em mais de um convênio" citando as duas chaves

### Requirement: Linhas de abas sem convênio na 342
O cruzamento SHALL listar como falha "linha sem convênio na 342" cada linha das outras 7 abas cuja chave não corresponde a nenhum convênio, com aba, linha da planilha, chave e códigos. Esses códigos MUST NOT ser atribuídos a convênio algum.

#### Scenario: Convênio da 89 com número diferente na 342
- **WHEN** a 89 tem uma linha com chave `143/2014`–`Paraty`, e a 342 não tem essa chave
- **THEN** a linha aparece como "linha sem convênio na 342", e seus códigos não entram em nenhum convênio

### Requirement: Cruzamento calculado sobre os dados carregados
O cruzamento SHALL refletir sempre o conteúdo atual de `siafe_flexvision` e das tabelas da planilha, sem etapa própria de carga. Ele MUST NOT alterar dados nem a execução das cargas do SIAFE e da planilha. Com uma das fontes vazia, as consultas MUST responder sem erro.

#### Scenario: Só a planilha é recarregada
- **WHEN** uma nova importação da planilha termina com sucesso e o SIAFE não é recarregado
- **THEN** a próxima consulta ao cruzamento já usa os códigos da nova importação

#### Scenario: SIAFE ainda não carregado
- **WHEN** `siafe_flexvision` está vazia e a planilha está carregada
- **THEN** os convênios aparecem sem saldo, e cada código aparece como "código fora do SIAFE"
