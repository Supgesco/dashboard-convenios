# painel-gerencial Specification

## Purpose

Expor por HTTP, só para leitura, a visão gerencial da carteira de convênios: saldos do SIAFE vinculados, valores contratuais da planilha, série mensal, ranking por município e lista de convênios. Cada número é recortável pela fase da carteira e pelos municípios.

## Requirements

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

### Requirement: Data das cargas na resposta do resumo
`/painel/resumo` SHALL informar o fim da última carga SIAFE bem-sucedida e o fim e o nome do arquivo da última importação da planilha bem-sucedida. Cada campo MUST ser nulo quando a carga correspondente nunca teve sucesso.

#### Scenario: Última carga falhou
- **WHEN** a carga SIAFE mais recente falhou e a anterior teve sucesso
- **THEN** a posição do SIAFE é o fim da carga anterior

#### Scenario: Planilha nunca importada
- **WHEN** não existe importação da planilha com sucesso
- **THEN** a data e o arquivo da planilha vêm nulos

### Requirement: Saldos SIAFE vinculados sem dupla contagem
`/painel/resumo` SHALL trazer, para o mês de referência, a soma dos 4 saldos (a pagar, a comprovar, a aprovar e aprovados) das contas do SIAFE cujos códigos pertencem aos convênios do recorte e do filtro. Um código pertencente a mais de um desses convênios MUST ser somado uma única vez. Meses MUST NOT ser somados entre si.

#### Scenario: Código compartilhado por dois convênios
- **WHEN** os convênios A e B do recorte têm o código `900001`, com R$ 100,00 a pagar no mês
- **THEN** o total a pagar do resumo inclui R$ 100,00 uma vez

#### Scenario: Conta sem convênio
- **WHEN** o SIAFE tem no mês uma conta que não pertence a nenhum convênio
- **THEN** ela não entra nos saldos do resumo

### Requirement: Saldos do mês anterior
`/painel/resumo` SHALL trazer os 4 saldos do mês imediatamente anterior ao de referência, com o mesmo recorte, filtro e regra de contagem. Eles MUST vir nulos quando o SIAFE não tem linhas nesse mês.

#### Scenario: Virada de ano
- **WHEN** a referência é 2026-01
- **THEN** o mês anterior é 2025-12

#### Scenario: Primeiro mês carregado
- **WHEN** a referência é 2023-01, o primeiro mês carregado
- **THEN** os saldos do mês anterior vêm nulos

### Requirement: Cobertura do saldo vinculado
Sem filtro de município, `/painel/resumo` SHALL trazer a cobertura do mês. Ela tem o saldo vinculado ao recorte, igual aos saldos do resumo, e o saldo total de todas as contas do SIAFE no mês, para cada um dos 4 saldos. Com qualquer município no filtro, a cobertura MUST ser nula.

#### Scenario: Cobertura com contas sem convênio
- **WHEN** no mês o recorte tem R$ 80,00 a pagar e uma conta sem convênio tem R$ 20,00
- **THEN** a cobertura a pagar traz vinculado R$ 80,00 e total R$ 100,00

#### Scenario: Com filtro de município
- **WHEN** a requisição traz algum `municipio`
- **THEN** a cobertura vem nula

### Requirement: Valores contratuais dos recortes 31 e 89
Nos recortes `31` e `89`, o resumo SHALL trazer os valores contratuais somados sobre os convênios do recorte e do filtro, lidos só da aba do recorte. Os valores são: valor total, repasse do Estado, contrapartida, investido pelo Estado e a repassar. O valor total, o repasse e a contrapartida MUST vir do grupo realinhado quando o convênio tem valor total realinhado, e do inicial nos demais casos. No recorte `342`, o bloco MUST ser nulo.

#### Scenario: Convênio realinhado
- **WHEN** a linha do convênio na 89 tem valor total inicial R$ 1.000,00 e realinhado R$ 1.200,00
- **THEN** o valor total do convênio no recorte `89` é R$ 1.200,00

#### Scenario: Convênio sem realinhamento
- **WHEN** a linha do convênio na 31 tem só o valor total inicial R$ 500,00
- **THEN** o valor total do convênio no recorte `31` é R$ 500,00

#### Scenario: Cada recorte lê a sua aba
- **WHEN** o mesmo convênio tem a repassar R$ 300,00 na 31 e R$ 400,00 na 89
- **THEN** o recorte `31` usa R$ 300,00 e o `89` usa R$ 400,00

#### Scenario: Recorte 342
- **WHEN** a requisição traz `recorte=342`
- **THEN** o bloco de valores contratuais vem nulo

### Requirement: Linhas de continuação nos valores contratuais
Os valores contratuais em R$ de um convênio SHALL ser a soma de todas as suas linhas na aba do recorte, principais e de continuação. Um convênio sem nenhum valor preenchido MUST ter o valor nulo, e não zero.

#### Scenario: Repasse numa linha de continuação
- **WHEN** a linha principal do convênio na 89 tem valor repassado R$ 100,00 e a linha de continuação tem R$ 50,00
- **THEN** o investido pelo Estado considera os valores das duas linhas

#### Scenario: Convênio sem valores
- **WHEN** todas as linhas do convênio têm os valores contratuais nulos
- **THEN** os valores contratuais do convênio vêm nulos

### Requirement: Percentual de execução
O percentual de execução SHALL ser o investido pelo Estado dividido pelo repasse do Estado, ambos somados sobre o conjunto mostrado (recorte, município ou convênio). Ele MUST NOT ser a média ou a soma de percentuais. Com repasse nulo ou zero, MUST ser nulo.

#### Scenario: Quociente de somas
- **WHEN** o convênio A tem investido R$ 50,00 e repasse R$ 100,00, e o B tem investido R$ 300,00 e repasse R$ 300,00
- **THEN** o percentual do conjunto é 350 ÷ 400 = 87,5%, e não a média 75%

#### Scenario: Repasse zero
- **WHEN** o repasse do Estado somado é zero
- **THEN** o percentual vem nulo

### Requirement: Situação dos convênios no recorte 342
No recorte `342`, o resumo SHALL trazer a contagem de convênios do filtro por status do convênio e por situação da vigência, lidos da linha da 342 que origina o convênio. Valores não informados MUST ser contados num grupo próprio, com valor nulo. Nos recortes `31` e `89`, esse bloco MUST ser nulo.

#### Scenario: Contagem por status
- **WHEN** o recorte `342` tem 3 convênios com status `Concluído`, 1 `Em execução` e 1 sem status
- **THEN** a contagem por status traz 3, 1 e 1 no grupo nulo

### Requirement: Série mensal dos saldos
`GET /painel/serie` SHALL trazer, para cada mês carregado no SIAFE, em ordem cronológica, os 4 saldos vinculados ao recorte e ao filtro, com a mesma regra de contagem única por código do resumo.

#### Scenario: Série completa
- **WHEN** o SIAFE tem dados de 2023-01 a 2026-11
- **THEN** a série tem um ponto por mês nesse intervalo, do mais antigo ao mais recente

#### Scenario: SIAFE vazio
- **WHEN** o SIAFE não tem linhas
- **THEN** a série é uma lista vazia

### Requirement: Ranking por município
`GET /painel/municipios` SHALL trazer uma linha por município que tem convênio no recorte e no filtro. Cada linha tem o número de convênios, os 4 saldos do mês, sem repetir código dentro do município, e, nos recortes `31` e `89`, os valores contratuais e o percentual de execução. A linha MUST indicar quando algum código do município também pertence a convênio de outro município.

#### Scenario: Ranking sem filtro
- **WHEN** a requisição não traz `municipio`
- **THEN** o ranking tem todos os municípios com convênio no recorte

#### Scenario: Código compartilhado entre municípios
- **WHEN** o código `900001` pertence a um convênio de Paraty e a outro de Resende
- **THEN** o saldo dele entra nas duas linhas, e ambas indicam código compartilhado

### Requirement: Lista de convênios
`GET /painel/convenios` SHALL trazer uma linha por convênio do recorte e do filtro, com:
- número, município, status, fase e códigos;
- os 4 saldos do mês;
- nos recortes `31` e `89`, os valores contratuais e o percentual de execução.

A linha MUST indicar quando algum código do convênio também pertence a outro convênio.

#### Scenario: Lista filtrada
- **WHEN** a requisição traz `recorte=89&municipio=Paraty`
- **THEN** a lista tem só os convênios de Paraty presentes na 89

#### Scenario: Convênio sem código
- **WHEN** um convênio do recorte não tem código
- **THEN** ele aparece na lista com os saldos nulos

### Requirement: Paginação das listas
`/painel/municipios` e `/painel/convenios` SHALL paginar os itens com `pagina` (a partir de 1, padrão 1) e `tamanho` (1 a 100, padrão 20). A resposta MUST trazer `pagina`, `tamanho`, `total` (itens do recorte e do filtro, sem paginar) e só os itens da página. Valores fora dos limites MUST gerar 422. Página além do fim MUST devolver lista vazia com o `total` correto. `/painel/serie` MUST NOT ser paginada.

#### Scenario: Tamanho padrão
- **WHEN** o recorte `342` tem 83 municípios e a requisição não traz `pagina` nem `tamanho`
- **THEN** a resposta tem 20 itens, `pagina` 1, `tamanho` 20 e `total` 83

#### Scenario: Última página
- **WHEN** a requisição traz `pagina=2&tamanho=50` para os mesmos 83 municípios
- **THEN** a resposta tem 33 itens

#### Scenario: Página além do fim
- **WHEN** a requisição traz `pagina=5&tamanho=50` para os mesmos 83 municípios
- **THEN** a resposta tem lista vazia e `total` 83

#### Scenario: Limites inválidos
- **WHEN** a requisição traz `tamanho=0`, `tamanho=101` ou `pagina=0`
- **THEN** a resposta é 422

#### Scenario: Série sem paginação
- **WHEN** o SIAFE tem 47 meses carregados
- **THEN** `/painel/serie` traz os 47 pontos numa única resposta

### Requirement: Ordenação das listas paginadas
`/painel/municipios` e `/painel/convenios` SHALL aceitar `ordem`, um campo numérico ou de identificação da linha, com `-` na frente para ordem decrescente. A ordenação MUST valer sobre todo o conjunto, antes da paginação, com nulos por último e desempate por município e número do convênio. Sem `ordem`, vale município e depois número. Campo fora da lista MUST gerar 422.

#### Scenario: Ranking pelo maior saldo a pagar
- **WHEN** a requisição traz `ordem=-a_pagar&tamanho=10`
- **THEN** vêm os 10 municípios de maior saldo a pagar de todo o recorte, com os nulos por último

#### Scenario: Ordem crescente com nulos por último
- **WHEN** a requisição traz `ordem=valor_total` e alguns convênios têm valor total nulo
- **THEN** os convênios vêm do menor ao maior valor total, e os nulos ficam no fim

#### Scenario: Páginas estáveis
- **WHEN** dois convênios têm o mesmo `a_pagar` e a requisição ordena por `-a_pagar`
- **THEN** a ordem entre eles segue município e número, igual em todas as requisições

#### Scenario: Campo inválido
- **WHEN** a requisição traz `ordem=senha`
- **THEN** a resposta é 422

### Requirement: Endpoints só de leitura
Os endpoints `/painel/*` SHALL ser `GET` e MUST NOT alterar dados nem disparar cargas. Os números refletem o conteúdo carregado no momento da requisição.

#### Scenario: Nova carga refletida
- **WHEN** a planilha é reimportada com outro conteúdo
- **THEN** a requisição seguinte a `/painel/resumo` reflete o novo conteúdo

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

### Requirement: Percentual do investido sobre o valor total
Onde há valores contratuais, ou seja, no resumo, no ranking, na lista e em cada bloco do detalhe, a API SHALL trazer `investido_sobre_total_pct`. O campo é o investido pelo Estado dividido pelo valor total, ambos somados sobre o conjunto mostrado, em percentual com 2 casas. Ele MUST NOT ser média nem soma de percentuais, e MUST ser nulo com valor total nulo ou zero. O `execucao_pct` não muda. Ranking e lista SHALL aceitá-lo em `ordem`.

#### Scenario: Quociente de somas
- **WHEN** o convênio A tem investido R$ 50,00 e valor total R$ 200,00, e o B tem investido R$ 300,00 e valor total R$ 300,00
- **THEN** o percentual do conjunto é 350 ÷ 500 = 70%, e não a média 62,5%

#### Scenario: Diferente do percentual de execução
- **WHEN** um convênio tem valor total R$ 1.000,00, repasse do Estado R$ 800,00 e investido R$ 400,00
- **THEN** `investido_sobre_total_pct` é 40 e `execucao_pct` é 50

#### Scenario: Valor total zero
- **WHEN** o valor total somado é zero ou nulo
- **THEN** `investido_sobre_total_pct` vem nulo

#### Scenario: Recorte 342
- **WHEN** a requisição traz `recorte=342`
- **THEN** o bloco contratual do resumo vem nulo, e com ele o percentual

#### Scenario: Ordenar pelo percentual
- **WHEN** a requisição a `/painel/convenios` traz `ordem=-investido_sobre_total_pct`
- **THEN** os convênios vêm do maior para o menor percentual, com os nulos por último
