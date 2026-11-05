## MODIFIED Requirements

### Requirement: Filtros globais na URL
As telas Municípios e Convênios SHALL compartilhar um bloco de filtros no topo do conteúdo, com recorte, municípios (seleção múltipla) e mês de referência. O recorte é um de Histórico inicial (342), Primeiro realinhamento (89) ou Vigentes (31), com padrão Vigentes. O estado dos filtros SHALL ficar na URL: recarregar a página ou abrir o link em outra aba SHALL reproduzir a mesma visão, e trocar de tela pelo menu SHALL manter os filtros, inclusive passando pela Visão geral, que não mostra o bloco de filtros nem usa os filtros.

#### Scenario: Recarregar mantém os filtros
- **WHEN** o usuário escolhe o recorte Primeiro realinhamento (89) e o município Paraty e recarrega a página
- **THEN** a tela volta com o recorte 89 e Paraty selecionados, e os dados pedidos à API usam esses filtros

#### Scenario: Trocar de tela mantém os filtros
- **WHEN** o usuário está em Municípios com o recorte Histórico inicial (342) e abre Convênios pelo menu
- **THEN** a lista de convênios abre com o recorte 342

#### Scenario: Passar pela Visão geral mantém os filtros
- **WHEN** o usuário está em Convênios com o recorte 89 e Paraty, abre a Visão geral e volta para Convênios pelo menu
- **THEN** a Visão geral aparece sem o bloco de filtros, e Convênios volta com o recorte 89 e Paraty

#### Scenario: Filtro inválido na URL
- **WHEN** a URL traz um recorte fora de 31, 89 e 342 ou um município que a API recusa com 422
- **THEN** o app mostra uma mensagem dizendo qual filtro é inválido e oferece limpar os filtros, sem página em branco

### Requirement: Mês de referência padrão
Sem mês na URL, as telas com filtro SHALL usar o último mês com dados do SIAFE informado pela API (`ultimo_mes_disponivel`), e não o mês corrente. O seletor de mês SHALL mostrar qual mês está em uso. Quando a API não informa nenhum mês disponível, as telas SHALL seguir o padrão da API (mês corrente).

#### Scenario: Início do mês sem carga
- **WHEN** a carga do SIAFE vai até outubro, hoje é 2 de novembro e a URL não traz mês
- **THEN** a tela Convênios mostra os saldos de outubro, com outubro indicado no seletor

#### Scenario: Mês escolhido sem dados
- **WHEN** o usuário escolhe um mês que o SIAFE não tem
- **THEN** os saldos aparecem como ausentes, com aviso de que o mês não tem dados e de qual é o último mês disponível

### Requirement: Estados de carregamento e erro
Toda tela que lê a API SHALL indicar o carregamento enquanto espera a resposta. Uma falha da API (erro HTTP ou de rede) SHALL aparecer como mensagem na área afetada, com opção de tentar de novo, sem derrubar o resto da tela. A mensagem SHALL usar o `detail` da API quando houver.

#### Scenario: API fora do ar
- **WHEN** a API não responde ao abrir a tela Convênios
- **THEN** a tela mostra a falha e um botão de tentar de novo, e o menu e a barra de filtros continuam utilizáveis

#### Scenario: Falha num bloco da Visão geral
- **WHEN** a API responde, mas falha só o pedido da lista dos vigentes
- **THEN** a lista mostra a falha com o botão de tentar de novo, e os cards, o gráfico por status e o top 10 continuam visíveis

### Requirement: Lista de convênios
A tela Convênios SHALL mostrar, acima da lista, os 4 saldos SIAFE do recorte, dos municípios e do mês em uso, em cards de destaque, com o valor em tamanho grande e a variação sobre o mês anterior. A variação SHALL ser indicada por sinal e seta, e não só por cor.

A tela SHALL mostrar a lista da API em tabela paginada e ordenável no servidor, com número, município, status, fase, códigos SEOBRAS/SEIOP, a marca de código compartilhado, os 4 saldos e, nos recortes 31 e 89, os valores contratuais. O clique numa linha SHALL abrir o detalhe daquele convênio.

#### Scenario: Cards dos saldos
- **WHEN** o usuário abre Convênios no recorte 31 com o município Paraty
- **THEN** a tela mostra os 4 saldos SIAFE de Paraty no recorte 31 e no mês em uso, cada um com a variação

#### Scenario: Variação sem mês anterior
- **WHEN** o mês anterior não tem dados ou o saldo anterior é ausente ou zero
- **THEN** a variação do card aparece como "—"

#### Scenario: Variação sem depender da cor
- **WHEN** o saldo a pagar subiu 12,5% sobre o mês anterior
- **THEN** o card mostra "+12,5%" com uma seta para cima

#### Scenario: Abrir o detalhe
- **WHEN** o usuário clica na linha do convênio 143/2014 de Paraty
- **THEN** abre o detalhe identificado por número 143/2014 e município Paraty, com o mês em uso

#### Scenario: Lista vazia
- **WHEN** o filtro não tem convênios
- **THEN** a tabela mostra uma mensagem de lista vazia, com total 0

### Requirement: Leitura das tabelas
As tabelas de dados SHALL:
- alinhar os números à direita, com algarismos de mesma largura;
- separar as linhas por um traço fino, sem alternar o fundo;
- manter o cabeçalho visível durante a rolagem vertical.

Linhas clicáveis SHALL ter destaque ao passar o mouse e ao receber foco pelo teclado.

#### Scenario: Rolar uma tabela longa
- **WHEN** o usuário rola a tabela de convênios para baixo
- **THEN** o cabeçalho das colunas continua visível

#### Scenario: Linha clicável pelo teclado
- **WHEN** o usuário chega a uma linha da lista pelo Tab
- **THEN** a linha fica destacada, e Enter abre o detalhe

## ADDED Requirements

### Requirement: Visão geral da carteira
A Visão geral SHALL ser um resumo fixo da carteira inteira, sem filtros: ela SHALL NOT mostrar o bloco de filtros nem usar recorte, município ou mês da URL. Ela SHALL mostrar, nesta ordem:
- os cards gerais;
- o gráfico de convênios por status e o top 10 municípios;
- a lista dos convênios vigentes;
- as datas da posição do SIAFE e da importação da planilha.

Os 4 saldos SIAFE, a cobertura e a série mensal SHALL NOT aparecer na Visão geral.

#### Scenario: Abrir a Visão geral
- **WHEN** o usuário abre a Visão geral
- **THEN** a tela mostra os cards gerais, o gráfico por status, o top 10 municípios, a lista dos vigentes e as datas das cargas, sem o bloco de filtros

#### Scenario: Filtros na URL são ignorados
- **WHEN** o usuário abre a Visão geral com `recorte=89&municipio=Paraty` na URL
- **THEN** a tela mostra os mesmos números de quando abre sem esses parâmetros

#### Scenario: Sem saldos SIAFE
- **WHEN** o usuário abre a Visão geral
- **THEN** a tela não mostra os cards de a pagar, a comprovar, a aprovar e aprovados, nem a cobertura, nem o gráfico mensal

### Requirement: Cards gerais da Visão geral
A Visão geral SHALL mostrar em cards de destaque, com o valor em tamanho grande:
- Cadastrados: os convênios do Histórico inicial e em quantos municípios eles estão;
- Vigentes: os convênios dos Vigentes e em quantos municípios eles estão;
- o valor total conveniado dos Vigentes;
- o investido pelo Estado nos Vigentes, com o percentual sobre o valor total conveniado;
- o saldo a repassar dos Vigentes.

As quantidades e os valores SHALL vir da API e nunca ser fixados no código.

#### Scenario: Cards com os números da API
- **WHEN** a API informa 342 convênios em 83 municípios no Histórico inicial e 31 convênios em 14 municípios nos Vigentes
- **THEN** os cards mostram "342" com "83 municípios" e "31" com "14 municípios"

#### Scenario: Percentual do investido
- **WHEN** a API informa, para os Vigentes, valor total R$ 1.000,00, investido R$ 370,00 e percentual 37
- **THEN** o card do investido mostra R$ 370,00 e 37,0%, com uma barra de progresso

#### Scenario: Percentual ausente
- **WHEN** o percentual do investido vem nulo
- **THEN** o card mostra "—" no percentual e não mostra a barra

### Requirement: Convênios por status e top 10 municípios
A Visão geral SHALL mostrar dois gráficos de barras horizontais sobre todos os convênios cadastrados (Histórico inicial):
- a quantidade de convênios por status, do maior para o menor, com os sem status num grupo "Sem informação";
- os 10 municípios com mais convênios, do maior para o menor, com empate desfeito pelo nome do município.

Cada barra SHALL trazer a quantidade escrita, e não só o comprimento.

#### Scenario: Status com grupo sem informação
- **WHEN** a API informa 200 convênios "Concluído", 120 "Em execução" e 22 sem status
- **THEN** o gráfico mostra as três barras nessa ordem, a última rotulada "Sem informação", cada uma com a quantidade

#### Scenario: Top 10
- **WHEN** a carteira tem 83 municípios
- **THEN** o gráfico mostra só os 10 com mais convênios, cada um com a quantidade

### Requirement: Lista dos vigentes na Visão geral
A Visão geral SHALL mostrar os convênios dos Vigentes em tabela paginada e ordenável no servidor, com número, município, status, valor total, investido pelo Estado e a repassar. A ordem padrão SHALL ser o valor total, do maior para o menor. O clique numa linha SHALL abrir o detalhe do convênio.

#### Scenario: Ordem padrão
- **WHEN** o usuário abre a Visão geral
- **THEN** a lista dos vigentes é pedida à API com recorte 31 e `ordem=-valor_total`

#### Scenario: Da lista para o detalhe
- **WHEN** o usuário clica na linha do convênio 143/2014 de Paraty na lista dos vigentes
- **THEN** abre o detalhe desse convênio

## REMOVED Requirements

### Requirement: Visão geral
**Reason**: A Visão geral deixa de ser uma visão do recorte, município e mês filtrados (saldos SIAFE, bloco contratual ou situação, cobertura e série mensal) e passa a ser o resumo fixo da carteira, descrito em "Visão geral da carteira".
**Migration**: Os 4 saldos SIAFE, com a variação e seus cenários, passam para a tela Convênios (requisito "Lista de convênios"). O bloco contratual por recorte continua no detalhe do convênio. A contagem por status passa a valer sobre os 342 cadastrados. A cobertura vinculado × total SIAFE e a série mensal do recorte saem das telas; as rotas da API continuam.
