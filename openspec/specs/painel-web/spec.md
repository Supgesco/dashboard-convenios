# painel-web Specification

## Purpose

Interface web do painel de convênios: permite consultar a carteira (visão geral, municípios, convênios e o detalhe de um convênio) e acompanhar e disparar as cargas, lendo apenas a API do painel e das cargas.

## Requirements

### Requirement: Navegação entre as telas
O app SHALL ter cinco telas acessíveis por um menu sempre visível: Visão geral, Municípios, Convênios, Detalhe do convênio (aberto a partir da lista ou por link) e Cargas. Cada tela SHALL ter um endereço próprio, que pode ser aberto diretamente e recarregado. Um endereço desconhecido SHALL mostrar uma página de "não encontrado" com link para a Visão geral.

O menu SHALL ficar numa barra lateral à esquerda e conter só a navegação, sem filtros. Em telas estreitas, a barra lateral SHALL ficar recolhida, ser aberta por um botão de menu e fechar ao escolher uma tela.

#### Scenario: Abrir uma tela pelo endereço
- **WHEN** o usuário abre diretamente o endereço da tela de Municípios
- **THEN** a tela de Municípios é exibida, com o menu indicando a tela atual

#### Scenario: Endereço desconhecido
- **WHEN** o usuário abre um endereço que não corresponde a nenhuma tela
- **THEN** o app mostra "não encontrado" com link para a Visão geral, sem página em branco

#### Scenario: Menu lateral
- **WHEN** o usuário abre qualquer tela numa tela larga
- **THEN** o menu de telas aparece numa barra lateral à esquerda, com a tela atual destacada

#### Scenario: Menu recolhível em tela estreita
- **WHEN** o usuário, numa tela estreita, toca no botão de menu e escolhe Convênios
- **THEN** o menu se abre, a tela Convênios é exibida e o menu volta a ficar recolhido

### Requirement: Filtros globais na URL
As telas Visão geral, Municípios e Convênios SHALL compartilhar um bloco de filtros no topo do conteúdo, com recorte, municípios (seleção múltipla) e mês de referência. O recorte é um de Histórico inicial (342), Primeiro realinhamento (89) ou Vigentes (31), com padrão Vigentes. O estado dos filtros SHALL ficar na URL: recarregar a página ou abrir o link em outra aba SHALL reproduzir a mesma visão, e trocar de tela pelo menu SHALL manter os filtros.

#### Scenario: Recarregar mantém os filtros
- **WHEN** o usuário escolhe o recorte Primeiro realinhamento (89) e o município Paraty e recarrega a página
- **THEN** a tela volta com o recorte 89 e Paraty selecionados, e os dados pedidos à API usam esses filtros

#### Scenario: Trocar de tela mantém os filtros
- **WHEN** o usuário está na Visão geral com o recorte Histórico inicial (342) e abre Convênios pelo menu
- **THEN** a lista de convênios abre com o recorte 342

#### Scenario: Filtro inválido na URL
- **WHEN** a URL traz um recorte fora de 31, 89 e 342 ou um município que a API recusa com 422
- **THEN** o app mostra uma mensagem dizendo qual filtro é inválido e oferece limpar os filtros, sem página em branco

### Requirement: Opções do seletor de municípios
O seletor de municípios SHALL listar os municípios que têm convênio no recorte selecionado, obtidos da API do painel. Ao trocar o recorte, as opções SHALL ser atualizadas.

#### Scenario: Opções seguem o recorte
- **WHEN** o usuário troca o recorte de 342 para 31
- **THEN** o seletor passa a listar só os municípios com convênio no recorte 31

### Requirement: Mês de referência padrão
Sem mês na URL, as telas SHALL usar o último mês com dados do SIAFE informado pela API (`ultimo_mes_disponivel`), e não o mês corrente. O seletor de mês SHALL mostrar qual mês está em uso. Quando a API não informa nenhum mês disponível, as telas SHALL seguir o padrão da API (mês corrente).

#### Scenario: Início do mês sem carga
- **WHEN** a carga do SIAFE vai até outubro, hoje é 2 de novembro e a URL não traz mês
- **THEN** a Visão geral mostra os saldos de outubro, com outubro indicado no seletor

#### Scenario: Mês escolhido sem dados
- **WHEN** o usuário escolhe um mês que o SIAFE não tem
- **THEN** os saldos aparecem como ausentes, com aviso de que o mês não tem dados e de qual é o último mês disponível

### Requirement: Exibição de valores
Valores monetários SHALL ser exibidos em reais no formato pt-BR (`R$ 1.234,56`) e percentuais no formato pt-BR (`12,3%`). Um valor ausente (`null` na API) SHALL ser exibido como "—" e nunca como zero. Um valor zero SHALL ser exibido como zero.

#### Scenario: Ausente diferente de zero
- **WHEN** um convênio tem `a_pagar` igual a 0 e `a_comprovar` nulo
- **THEN** a linha mostra `R$ 0,00` em a pagar e "—" em a comprovar

#### Scenario: Percentual de execução
- **WHEN** a API devolve `execucao_pct` 45.5
- **THEN** a tela mostra `45,5%`

### Requirement: Estados de carregamento e erro
Toda tela que lê a API SHALL indicar o carregamento enquanto espera a resposta. Uma falha da API (erro HTTP ou de rede) SHALL aparecer como mensagem na área afetada, com opção de tentar de novo, sem derrubar o resto da tela. A mensagem SHALL usar o `detail` da API quando houver.

#### Scenario: API fora do ar
- **WHEN** a API não responde ao abrir a Visão geral
- **THEN** a tela mostra a falha e um botão de tentar de novo, e o menu e a barra de filtros continuam utilizáveis

### Requirement: Visão geral
A Visão geral SHALL mostrar, para os filtros e o mês em uso:
- a quantidade de convênios;
- os 4 saldos SIAFE com a variação sobre o mês anterior;
- o bloco contratual (recortes 31 e 89) ou a contagem por status e situação da vigência (recorte 342);
- a cobertura vinculado × total SIAFE, só sem filtro de município;
- o gráfico da série mensal dos 4 saldos;
- as datas da posição do SIAFE e da importação da planilha.

A quantidade de convênios e os 4 saldos SHALL aparecer em cards de destaque, com o valor em tamanho grande. A variação SHALL ser indicada por sinal e seta, e não só por cor.

#### Scenario: Recorte 31 sem filtro
- **WHEN** o usuário abre a Visão geral no recorte 31 sem municípios
- **THEN** a tela mostra os 4 saldos com a variação, o bloco contratual, a cobertura, a série e as datas das cargas

#### Scenario: Recorte 342
- **WHEN** o recorte é 342
- **THEN** no lugar do bloco contratual a tela mostra a contagem de convênios por status e por situação da vigência

#### Scenario: Com filtro de município
- **WHEN** há município selecionado
- **THEN** a cobertura não aparece e os demais blocos refletem só os municípios selecionados

#### Scenario: Variação sem mês anterior
- **WHEN** o mês anterior não tem dados ou o saldo anterior é ausente ou zero
- **THEN** a variação do card aparece como "—"

#### Scenario: Variação sem depender da cor
- **WHEN** o saldo a pagar subiu 12,5% sobre o mês anterior
- **THEN** o card mostra "+12,5%" com uma seta para cima

### Requirement: Ranking de municípios
A tela Municípios SHALL mostrar o ranking da API em tabela paginada, com o total de municípios. O clique num cabeçalho ordenável SHALL ordenar por aquele campo no servidor, e um segundo clique SHALL inverter a ordem. Municípios com código compartilhado SHALL ter uma marca visível com explicação. O clique numa linha SHALL abrir a tela Convênios filtrada por aquele município, mantendo recorte e mês.

#### Scenario: Ordenar pelo saldo a pagar
- **WHEN** o usuário clica duas vezes no cabeçalho "A pagar"
- **THEN** a tabela é pedida à API com `ordem=a_pagar` e depois com `ordem=-a_pagar`, e o cabeçalho indica a direção

#### Scenario: Paginação
- **WHEN** o ranking tem 83 municípios e o tamanho da página é 20
- **THEN** a tela mostra 5 páginas e o total 83, e a página escolhida fica na URL

#### Scenario: Da linha para os convênios
- **WHEN** o usuário clica na linha de Niterói no recorte 89
- **THEN** abre a tela Convênios com recorte 89 e o filtro Niterói

### Requirement: Lista de convênios
A tela Convênios SHALL mostrar a lista da API em tabela paginada e ordenável no servidor, com número, município, status, fase, códigos SEOBRAS/SEIOP, a marca de código compartilhado, os 4 saldos e, nos recortes 31 e 89, os valores contratuais. O clique numa linha SHALL abrir o detalhe daquele convênio.

#### Scenario: Abrir o detalhe
- **WHEN** o usuário clica na linha do convênio 143/2014 de Paraty
- **THEN** abre o detalhe identificado por número 143/2014 e município Paraty, com o mês em uso

#### Scenario: Lista vazia
- **WHEN** o filtro não tem convênios
- **THEN** a tabela mostra uma mensagem de lista vazia, com total 0

### Requirement: Detalhe do convênio
O detalhe SHALL ser identificado no endereço pelo número e pelo município do convênio e SHALL mostrar:
- a identificação (número, município, fase, status, situação e data final da vigência, objeto, códigos, recortes);
- os convênios com código em comum, cada um com link para o próprio detalhe;
- os 4 saldos do mês de referência e do mês anterior;
- um bloco de valores contratuais por recorte (Vigentes e/ou Primeiro realinhamento), ou um aviso quando não há nenhum;
- o gráfico da série mensal do convênio.

Os recortes do convênio e os títulos dos blocos contratuais SHALL usar os nomes dos recortes.

#### Scenario: Convênio vigente
- **WHEN** o usuário abre o detalhe de um convênio dos recortes 31, 89 e 342
- **THEN** a tela mostra:
  - a identificação, com os recortes Vigentes, Primeiro realinhamento e Histórico inicial;
  - os saldos;
  - dois blocos contratuais rotulados "Vigentes" e "Primeiro realinhamento";
  - a série.

#### Scenario: Convênio só da 342
- **WHEN** o convênio não está nos recortes 31 nem 89
- **THEN** a área contratual informa que não há valores contratuais para ele

#### Scenario: Convênio inexistente
- **WHEN** o endereço do detalhe traz uma chave que a API responde com 404
- **THEN** a tela informa que o convênio não foi encontrado, com link para a lista

#### Scenario: Chave inválida
- **WHEN** o endereço traz um número em formato inválido e a API responde 422
- **THEN** a tela mostra o motivo devolvido pela API

#### Scenario: Navegar para convênio com código compartilhado
- **WHEN** o usuário clica num dos convênios listados como compartilhando código
- **THEN** abre o detalhe daquele convênio

### Requirement: Acompanhamento das cargas
A tela Cargas SHALL mostrar a última carga SIAFE (status, origem, início, fim, registros e erro), o histórico paginado de cargas da mais recente para a mais antiga e a última importação da planilha (arquivo e data). Enquanto a última carga estiver `em_andamento`, a tela SHALL consultar o status a cada 5 segundos e parar quando ela terminar, atualizando também o histórico. Sem nenhuma carga registrada, a tela SHALL dizer isso em vez de mostrar erro.

#### Scenario: Carga em andamento
- **WHEN** a última carga está em andamento
- **THEN** a tela indica o andamento e atualiza o status a cada 5 s até ele virar sucesso ou falha

#### Scenario: Carga com falha
- **WHEN** a última carga terminou em falha
- **THEN** a tela mostra o status de falha e o texto do campo `erro`

#### Scenario: Nenhuma carga
- **WHEN** a API responde 404 ao status e o histórico vem vazio
- **THEN** a tela informa que nenhuma carga SIAFE foi feita

#### Scenario: Planilha sem upload
- **WHEN** o usuário abre a tela Cargas
- **THEN** a parte da planilha mostra só o arquivo e a data da última importação, sem opção de enviar arquivo

### Requirement: Disparo de carga SIAFE
A tela Cargas SHALL ter um botão para iniciar a carga SIAFE, que só dispara após uma confirmação explícita. A confirmação SHALL avisar que a carga faz login no SIAFE e substitui os dados atuais. O botão SHALL ficar desabilitado enquanto uma carga estiver em andamento. Se a API responder 409, a tela SHALL informar que já há carga em andamento e passar a acompanhá-la.

#### Scenario: Disparo confirmado
- **WHEN** o usuário clica em iniciar a carga e confirma
- **THEN** o app envia um único pedido de carga, a tela mostra a carga em andamento e começa a acompanhar o status

#### Scenario: Disparo cancelado
- **WHEN** o usuário clica em iniciar a carga e cancela a confirmação
- **THEN** nenhum pedido de carga é enviado

#### Scenario: Carga já em andamento
- **WHEN** a API responde 409 ao pedido de carga
- **THEN** a tela informa que já existe carga em andamento e acompanha o status dela

### Requirement: Somente leitura e sem dados persistidos no navegador
Fora o disparo de carga, o app SHALL apenas ler a API. O app SHALL NOT guardar dados de convênios no armazenamento do navegador (localStorage, sessionStorage, IndexedDB): os dados vêm da API a cada sessão.

#### Scenario: Nenhuma escrita além da carga
- **WHEN** o usuário navega por todas as telas sem iniciar carga
- **THEN** o app só faz pedidos GET à API

#### Scenario: Armazenamento do navegador vazio
- **WHEN** o usuário termina de navegar pelas telas
- **THEN** o armazenamento do navegador não contém dados de convênios

### Requirement: Nomes dos recortes
Em todas as telas, o app SHALL mostrar os recortes pelo nome: 342 é "Histórico inicial", 89 é "Primeiro realinhamento" e 31 é "Vigentes". O seletor SHALL ao lado de cada nome trazer a quantidade de convênios do recorte, informada pela API e sem filtro de município. Enquanto a quantidade não chega, ou se a API falhar, o seletor SHALL mostrar só o nome, e o filtro SHALL continuar utilizável. Os valores da URL SHALL continuar sendo `31`, `89` e `342`.

#### Scenario: Rótulos com a contagem da API
- **WHEN** a API informa 342 convênios no recorte 342, 89 no 89 e 31 no 31
- **THEN** o seletor mostra "Histórico inicial (342 convênios)", "Primeiro realinhamento (89 convênios)" e "Vigentes (31 convênios)", nessa ordem

#### Scenario: A contagem segue a API, não o código
- **WHEN** uma nova importação da planilha muda a quantidade do recorte 89 para 92
- **THEN** o seletor passa a mostrar "Primeiro realinhamento (92 convênios)"

#### Scenario: A contagem não depende do filtro de município
- **WHEN** há municípios selecionados
- **THEN** cada recorte do seletor continua mostrando o total de convênios do recorte inteiro

#### Scenario: Falha ao obter a contagem
- **WHEN** a API falha ao informar a quantidade de um recorte
- **THEN** o seletor mostra só o nome daquele recorte, e escolher o recorte continua funcionando

#### Scenario: URL inalterada
- **WHEN** o usuário escolhe "Primeiro realinhamento"
- **THEN** a URL passa a ter `recorte=89`

### Requirement: Sem termos de planilha nos textos das telas
Os textos das telas SHALL NOT citar "aba" nem os números de aba da planilha. Também SHALL NOT tratar a planilha como a origem dos convênios, mas SHALL referir-se aos recortes pelo nome. A informação da última importação da planilha (arquivo e data) SHALL continuar visível, porque é a identificação da fonte dos dados.

#### Scenario: Convênio inexistente
- **WHEN** o detalhe recebe 404 da API
- **THEN** a mensagem diz que o convênio não foi encontrado, sem mencionar a planilha

#### Scenario: Convênio sem valores contratuais
- **WHEN** o convênio não pertence aos recortes Vigentes nem Primeiro realinhamento
- **THEN** a área contratual informa que não há valores contratuais para ele, sem citar abas

### Requirement: Leitura das tabelas
As tabelas de dados SHALL:
- alinhar os números à direita, com algarismos de mesma largura;
- alternar o fundo das linhas de forma suave;
- manter o cabeçalho visível durante a rolagem vertical.

Linhas clicáveis SHALL ter destaque ao passar o mouse e ao receber foco pelo teclado.

#### Scenario: Rolar uma tabela longa
- **WHEN** o usuário rola a tabela de convênios para baixo
- **THEN** o cabeçalho das colunas continua visível

#### Scenario: Linha clicável pelo teclado
- **WHEN** o usuário chega a uma linha da lista pelo Tab
- **THEN** a linha fica destacada, e Enter abre o detalhe
