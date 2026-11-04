# planilha-convenios-ingestion Specification

## Purpose

Trazer para o banco do dashboard o conteúdo da planilha geral de convênios do programa Somando Forças, extraído, normalizado (textos, categorias, municípios, números e códigos de convênio) e carregado por um ETL sob demanda que substitui o conjunto anterior e deixa registro auditável.

## Requirements

### Requirement: Disparo por linha de comando
O sistema SHALL oferecer um comando, executável a partir de `api/` via uv, que recebe o caminho de um arquivo `.xlsx` e roda o ETL completo (extração, transformação e carga) de forma síncrona. O comando MUST sair com código 0 em caso de sucesso e com código diferente de zero em caso de falha, e MUST informar quantas linhas foram gravadas por aba e quantos avisos houve.

#### Scenario: Importação manual com sucesso
- **WHEN** o operador executa o comando com o caminho de uma planilha válida
- **THEN** o processo sai com código 0 e informa a contagem de linhas de cada uma das 8 abas importadas e o total de avisos

#### Scenario: Arquivo inexistente ou não-xlsx
- **WHEN** o caminho informado não existe ou não é um arquivo xlsx legível
- **THEN** o processo sai com código diferente de zero, com mensagem indicando o problema, e nenhum dado é alterado

### Requirement: Abas importadas, uma tabela por aba
Cada importação SHALL gravar 8 abas da planilha (342 Convênios, 89 Convênios, 31 Convênios Vigentes 2025, Prest de Contas Conv_Execução, Realinhado sem Exec_Expirado, Não Realinhado Expirado, Tomada de Contas e ACOMPANHAMENTO ESPECIAL), cada uma na sua própria tabela, já normalizada, com as colunas de dados da aba (inclusive as ocultas), exceto as repetidas. A aba Planilha2 MUST ser ignorada.

#### Scenario: Planilha completa
- **WHEN** uma planilha com as 8 abas importadas e a Planilha2 é importada com sucesso
- **THEN** cada uma das 8 tabelas contém as linhas de dados da aba correspondente, e nenhum dado da Planilha2 é gravado

#### Scenario: Colunas ocultas
- **WHEN** uma aba tem colunas ocultas com dados
- **THEN** esses dados são extraídos e tratados como os das colunas visíveis

### Requirement: Identificação das abas
O sistema SHALL identificar cada aba pelo nome, ignorando espaços nas pontas e espaços repetidos. Se faltar alguma das 8 abas importadas ou existir uma aba não reconhecida, a importação MUST falhar com mensagem listando as abas faltantes e as desconhecidas. A Planilha2 é reconhecida e ignorada, esteja presente ou não.

#### Scenario: Espaços no nome da aba
- **WHEN** a aba se chama `"89 Convênios "` (com espaço no fim)
- **THEN** ela é reconhecida como a aba 89 Convênios

#### Scenario: Aba nova na planilha
- **WHEN** o arquivo traz uma aba que não está entre as 8 importadas nem é a Planilha2
- **THEN** a importação falha citando o nome dessa aba e nenhum dado é alterado

### Requirement: Validação do cabeçalho
Antes de gravar, o sistema SHALL conferir o cabeçalho de cada coluna de cada aba com o esperado, ignorando espaços, quebras de linha e maiúsculas/minúsculas, e MUST falhar com aba, célula, texto esperado e encontrado se divergir. Um valor numa linha de dados fora das colunas conhecidas da aba MUST também fazer a importação falhar.

#### Scenario: Coluna inserida no meio da aba
- **WHEN** a equipe insere uma coluna nova na aba 89 Convênios, deslocando as seguintes
- **THEN** a importação falha indicando a primeira célula de cabeçalho divergente, e nenhum dado é alterado

#### Scenario: Valor além da última coluna
- **WHEN** uma linha de dados da aba Não Realinhado Expirado tem um valor na coluna L, que não existe no layout
- **THEN** a importação falha citando a aba e a célula, e nenhum dado é alterado

#### Scenario: Diferença só de espaçamento
- **WHEN** um cabeçalho difere do esperado apenas por espaços extras ou quebra de linha
- **THEN** o cabeçalho é aceito

### Requirement: Somente linhas de dados
O sistema SHALL importar apenas as linhas de dados de cada aba, excluindo títulos, cabeçalhos (inclusive cabeçalhos repetidos no meio da aba), linhas de total, quadros-resumo, legendas e notas de rodapé, além de linhas totalmente vazias dentro da faixa de dados. Se o marcador de fim de dados de uma aba não for encontrado, a importação MUST falhar.

#### Scenario: Linha de total
- **WHEN** a aba 89 Convênios termina com a linha "Total Geral Executado" e um quadro-resumo abaixo
- **THEN** nem a linha de total nem o quadro-resumo são importados

#### Scenario: Convênios da aba 89 com linhas de continuação
- **WHEN** a aba 89 Convênios tem 89 convênios, 8 deles ocupando mais de uma linha por causa das faixas de parcelas do realinhamento
- **THEN** são importadas todas as linhas desses 89 convênios (uma por linha da planilha, inclusive as de continuação), e só elas: as linhas com Item preenchido somam 89, com 89 itens distintos

#### Scenario: Aba com dois blocos
- **WHEN** a aba Tomada de Contas tem um segundo bloco com título e cabeçalho repetidos
- **THEN** as linhas de dados dos dois blocos são importadas, cada uma identificada pelo bloco de origem, e o título e o cabeçalho repetidos não

#### Scenario: Linhas vazias no meio dos dados
- **WHEN** a aba Prest de Contas Conv_Execução tem linhas totalmente vazias entre convênios
- **THEN** essas linhas são ignoradas e as linhas de dados depois delas são importadas

#### Scenario: Fim de dados não encontrado
- **WHEN** a linha de total esperada não existe mais na aba 31 Convênios Vigentes 2025
- **THEN** a importação falha citando a aba, e nenhum dado é alterado

### Requirement: Linha de origem e linhas de continuação
Cada linha gravada SHALL guardar o número da linha de origem na planilha e um indicador de linha principal. Nas abas 89 Convênios, 31 Convênios Vigentes 2025 e Prest de Contas Conv_Execução, a linha sem Item é de continuação: MUST herdar da linha principal anterior as colunas de identificação do convênio, mas MUST NOT herdar colunas de valor, quantidade ou percentual.

#### Scenario: Convênio que ocupa duas linhas
- **WHEN** um convênio da aba 89 Convênios ocupa as linhas 7 e 8, com item, município, número e valores iniciais mesclados verticalmente
- **THEN** são gravadas duas linhas (7 e 8); as duas têm item, município, número do convênio e códigos; só a linha 7 é principal e tem os valores iniciais; a linha 8 tem os valores iniciais nulos e só a sua faixa de parcelas do realinhamento

#### Scenario: Soma sem dupla contagem
- **WHEN** o dashboard soma o Valor Total Convênio (Inicial) da aba 89 Convênios
- **THEN** cada convênio é contado uma vez, porque as linhas de continuação não repetem esse valor

#### Scenario: Município mesclado na Tomada de Contas
- **WHEN** na aba Tomada de Contas o município está mesclado em várias linhas, uma por convênio
- **THEN** todas essas linhas recebem o município, e cada uma é principal

### Requirement: Limpeza de texto
Todo texto SHALL ser gravado sem espaços nas pontas e sem espaços repetidos. Rótulos curtos (município, situação, status, códigos) MUST ter também as quebras de linha trocadas por espaço. Textos livres (objeto, observação, parecer, processos) MUST manter as quebras de linha entre linhas não vazias. Células vazias, só com espaços, só com pontuação (`-`, `.`, `;`) ou com erro do Excel (`#REF!`, `#N/A` etc.) MUST virar nulo.

#### Scenario: Rótulo com quebras de linha
- **WHEN** a célula de município contém `"\nAperibé\n"`
- **THEN** o valor tratado é `"Aperibé"`

#### Scenario: Processos em várias linhas
- **WHEN** uma célula de processo contém `"E-17/001.335/2011 \nE-17/002.729/2011"`
- **THEN** a coluna recebe `"E-17/001.335/2011\nE-17/002.729/2011"`

#### Scenario: Marcadores de ausência
- **WHEN** uma coluna de texto traz `-`, `.` ou `#REF!`
- **THEN** a coluna fica nula

### Requirement: Categorias padronizadas
Colunas categóricas (status do convênio, situação, situação da vigência, andamento) SHALL ter cada valor trocado pela forma canônica do seu vocabulário, comparando sem diferença de maiúsculas, acentos e espaços. Realinhado MUST virar booleano (Sim/Não). Um valor fora do vocabulário MUST ser gravado limpo e gerar um aviso.

#### Scenario: Variações do mesmo valor
- **WHEN** a situação da vigência aparece como `"Vigente "`, `"vigente "` e `"Vigente"`
- **THEN** as três linhas recebem `"Vigente"`

#### Scenario: Realinhado como booleano
- **WHEN** a coluna Realinhado traz `"Sim "`, `"Sim"`, `"Não "` ou `"Não"`
- **THEN** a coluna recebe verdadeiro ou falso, respectivamente

#### Scenario: Valor desconhecido
- **WHEN** a coluna Status Convênio traz o número 22
- **THEN** a coluna recebe `"22"` e o registro da importação contém um aviso com aba, célula e valor

### Requirement: Município canônico
O município SHALL ser gravado com o nome oficial de um dos 92 municípios do estado do Rio de Janeiro, reconhecido sem diferença de maiúsculas, acentos e espaços e por uma lista de abreviações conhecidas. Um município não reconhecido MUST ser gravado limpo e gerar um aviso.

#### Scenario: Grafias diferentes do mesmo município
- **WHEN** as abas trazem `"SÃO JOSÉ DO VALE RIO PRETO"`, `"São J Vale do Rio Preto"` e `"SÃO J. DO V. DO RIO PRETO"`
- **THEN** todas recebem `"São José do Vale do Rio Preto"`

#### Scenario: Erro de digitação conhecido
- **WHEN** a célula traz `"Sâo Fidélis"` ou `"RioClaro"`
- **THEN** a coluna recebe `"São Fidélis"` ou `"Rio Claro"`, respectivamente

### Requirement: Número do convênio normalizado
O número do convênio SHALL ser gravado no formato `NNN/AAAA`, com o número completado com zeros à esquerda até 3 dígitos e o ano com 4 dígitos (anos de 2 dígitos são do século 2000), mantendo um sufixo de letra como `NNN-L/AAAA`. Um valor que não segue nenhum desses formatos MUST virar nulo e gerar um aviso.

#### Scenario: Ano com dois dígitos
- **WHEN** a aba 89 Convênios traz `"143/14"` e a aba 342 Convênios traz `"143/2014"`
- **THEN** as duas recebem `"143/2014"`

#### Scenario: Sufixo de letra
- **WHEN** o número aparece como `"012-A/2013"` ou `"012/A/2013"`
- **THEN** a coluna recebe `"012-A/2013"`

### Requirement: Códigos SEOBRAS e SEIOP
Os códigos do convênio no SIAFE SHALL ser gravados como texto de 6 dígitos com zeros à esquerda, em colunas de mesmo nome em todas as abas: código SEOBRAS (Nº SIAFEM na 342/ACOMPANHAMENTO, SIAFE - SEOBRAS nas demais, SIAFE na Tomada de Contas) e código SEIOP (Nº SIAFE na 342/ACOMPANHAMENTO, SIAFE - SEIOP nas demais). Um valor que não seja um código de até 6 dígitos MUST virar nulo e gerar um aviso.

#### Scenario: Mesmo código em formatos diferentes
- **WHEN** a aba 342 Convênios traz o número 7783, a aba 89 Convênios traz `"007783"` e outra linha traz `"'007695"`
- **THEN** as colunas recebem `"007783"`, `"007783"` e `"007695"`

#### Scenario: Dois códigos na mesma célula
- **WHEN** a célula traz `"210014/ 007645"`
- **THEN** a coluna fica nula e é gerado um aviso com o valor original

### Requirement: Correção de colunas deslocadas
Nas abas 342 Convênios e ACOMPANHAMENTO ESPECIAL, quando a coluna Realinhado de uma linha contém uma data, o sistema SHALL tratar as colunas Realinhado, Vigência Final, Situação Vigência e Prestação de Contas dessa linha como deslocadas uma posição à esquerda: a data vai para a vigência final, o texto seguinte para a situação da vigência e o próximo para a prestação de contas, e realinhado fica nulo. A linha MUST ser marcada como corrigida.

#### Scenario: Linha deslocada
- **WHEN** uma linha da aba 342 Convênios tem 31/12/2023 em Realinhado, `"Expirado"` em Vigência Final e as duas colunas seguintes vazias
- **THEN** a linha é gravada com vigência final 2023-12-31, situação da vigência `"Expirado"`, realinhado nulo e marcada como corrigida

#### Scenario: Linha alinhada
- **WHEN** uma linha tem `"Não"` em Realinhado, uma data em Vigência Final e `"Expirado"` em Situação Vigência
- **THEN** a linha é gravada sem deslocamento: realinhado falso, a data como vigência final, a situação `"Expirado"`, e não é marcada como corrigida

### Requirement: Colunas repetidas descartadas
Colunas que repetem dados de outra coluna da mesma aba (na aba 31 Convênios Vigentes 2025, o segundo e o terceiro Município e o segundo Nº do Convênio Original) SHALL NOT ser gravadas. O segundo Item da aba 31 é numeração própria da seção de homologação e MUST ser gravado como coluna própria. Se o valor tratado de uma delas divergir do da coluna original na mesma linha, o sistema MUST gerar um aviso.

#### Scenario: Repetição divergente
- **WHEN** na aba 31 o segundo Município de uma linha difere do primeiro depois da normalização
- **THEN** é gravado só o primeiro, e é gerado um aviso com as duas células

### Requirement: Colunas de data e número tipadas
Colunas de data SHALL ser gravadas como data, colunas de valor ou percentual como numérico exato com até 15 dígitos significativos (a precisão do Excel) e quantidades, Item e Parcela como inteiro. Percentuais MUST ser gravados como estão na célula (0,92 para 92%). Texto numérico simples (`10.5`) ou no formato brasileiro (`1.234,56`) MUST ser convertido.

#### Scenario: Valor monetário com resíduo de ponto flutuante
- **WHEN** a célula de cronograma de repasse contém 991879.4210000001
- **THEN** a coluna recebe exatamente 991879.421

#### Scenario: Data de vigência
- **WHEN** a célula de vigência contém 31/12/2025
- **THEN** a coluna recebe a data 2025-12-31

#### Scenario: Número digitado como texto no formato brasileiro
- **WHEN** a coluna Valor Executado no Período traz o texto `"
2.036.643,30
"`
- **THEN** a coluna recebe 2036643.30, sem aviso

#### Scenario: Item e parcela como texto
- **WHEN** a coluna Parcela traz `"3"` como texto numa linha e o número 3 em outra
- **THEN** as duas recebem o inteiro 3

### Requirement: Avisos em vez de perda silenciosa
Um valor que a transformação não consegue aproveitar SHALL virar nulo (ou ser gravado limpo, nos casos de categoria e município) sem fazer a importação falhar, e MUST gerar um aviso com aba, célula, coluna, motivo e valor original. Célula vazia ou só com marcador de ausência MUST virar nulo sem aviso.

#### Scenario: Texto numa coluna de valor
- **WHEN** a coluna Valor Executado no Período traz "Verificar NL"
- **THEN** a coluna fica nula, a importação continua e o registro da importação contém um aviso com a aba, a célula, o motivo e o valor "Verificar NL"

#### Scenario: Traço como ausência de valor
- **WHEN** a coluna Valor Total Convênio (Realinhado) traz `-`
- **THEN** a coluna fica nula e nenhum aviso é gerado

### Requirement: Overwrite atômico
Uma importação bem-sucedida SHALL substituir integralmente o conteúdo das 8 tabelas da planilha pelos dados do arquivo, numa única transação. Até o commit, quem consulta o banco MUST continuar vendo o conjunto anterior completo. Uma importação que falha MUST NOT alterar nenhuma das tabelas.

#### Scenario: Reimportação com sucesso
- **WHEN** uma nova revisão da planilha é importada com sucesso
- **THEN** as 8 tabelas contêm exatamente as linhas dessa importação e nenhuma da anterior

#### Scenario: Falha de validação em uma aba
- **WHEN** a última aba lida tem um cabeçalho divergente
- **THEN** nenhuma das 8 tabelas é alterada, inclusive as das abas que já tinham sido lidas

### Requirement: Uma importação por vez
O sistema SHALL permitir apenas uma importação da planilha em andamento por vez. Uma segunda tentativa enquanto outra roda MUST ser recusada sem ler o arquivo e sem alterar dados. A importação da planilha MUST NOT bloquear nem ser bloqueada pela carga do SIAFE.

#### Scenario: Importação concorrente
- **WHEN** o comando é executado enquanto outra importação da planilha está em andamento
- **THEN** a segunda execução termina com código diferente de zero, informando a importação em andamento

#### Scenario: Carga SIAFE simultânea
- **WHEN** uma carga SIAFE está em andamento e uma importação da planilha é iniciada
- **THEN** a importação da planilha roda normalmente

### Requirement: Registro de cada importação
Cada importação SHALL deixar um registro com início, fim, status (em andamento, sucesso ou falha), nome e hash SHA-256 do arquivo, quantidade de linhas por aba, avisos e, em caso de falha, a mensagem de erro. O registro MUST persistir mesmo quando a importação falha, e cada linha importada MUST referenciar o registro da importação que a gravou.

#### Scenario: Importação que falha
- **WHEN** a importação falha na validação de layout
- **THEN** o registro da importação fica com status de falha e a mensagem do erro, e as tabelas continuam com os dados da última importação bem-sucedida

#### Scenario: Importação interrompida
- **WHEN** o processo de uma importação morre sem finalizar o registro
- **THEN** a próxima importação marca esse registro como falha antes de começar

### Requirement: Dados reais fora do repositório
Testes e exemplos da importação MUST usar planilhas sintéticas com o mesmo layout. A planilha real e qualquer extrato dela MUST NOT ser versionados.

#### Scenario: Suíte de testes
- **WHEN** a suíte de testes da importação roda
- **THEN** ela usa apenas planilhas geradas pelos próprios testes, com valores fictícios
