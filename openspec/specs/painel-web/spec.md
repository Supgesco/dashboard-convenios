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

### Requirement: Opções do seletor de municípios
O seletor de municípios SHALL listar os municípios que têm convênio no recorte selecionado, obtidos da API do painel. Ao trocar o recorte, as opções SHALL ser atualizadas.

#### Scenario: Opções seguem o recorte
- **WHEN** o usuário troca o recorte de 342 para 31
- **THEN** o seletor passa a listar só os municípios com convênio no recorte 31

### Requirement: Mês de referência padrão
Sem mês na URL, as telas com filtro SHALL usar o último mês com dados do SIAFE informado pela API (`ultimo_mes_disponivel`), e não o mês corrente. O seletor de mês SHALL mostrar qual mês está em uso. Quando a API não informa nenhum mês disponível, as telas SHALL seguir o padrão da API (mês corrente).

#### Scenario: Início do mês sem carga
- **WHEN** a carga do SIAFE vai até outubro, hoje é 2 de novembro e a URL não traz mês
- **THEN** a tela Convênios mostra os saldos de outubro, com outubro indicado no seletor

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
- **WHEN** a API não responde ao abrir a tela Convênios
- **THEN** a tela mostra a falha e um botão de tentar de novo, e o menu e a barra de filtros continuam utilizáveis

#### Scenario: Falha num bloco da Visão geral
- **WHEN** a API responde, mas falha só o pedido da lista dos vigentes
- **THEN** a lista mostra a falha com o botão de tentar de novo, e os cards, o gráfico por status e o top 10 continuam visíveis

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
A Visão geral SHALL mostrar dois gráficos sobre todos os convênios cadastrados (Histórico inicial):
- uma rosca da quantidade de convênios por status;
- um gráfico de barras horizontais com os 10 municípios com mais convênios, do maior para o menor, com empate desfeito pelo nome do município.

Cada barra do top 10 SHALL trazer a quantidade escrita, e não só o comprimento.

#### Scenario: Status em rosca
- **WHEN** o usuário abre a Visão geral
- **THEN** os convênios por status aparecem numa rosca, e o top 10 municípios em barras horizontais

#### Scenario: Top 10
- **WHEN** a carteira tem 83 municípios
- **THEN** o gráfico mostra só os 10 com mais convênios, cada um com a quantidade

### Requirement: Rosca de status da Visão geral
A rosca SHALL dar fatia própria aos 5 status com mais convênios e somar o resto numa fatia "Outros", que só aparece se houver resto. Os sem status SHALL formar o grupo "Sem informação", que disputa o top 5 como qualquer status. "Vigência não confirmada" SHALL NOT ter fatia própria e SHALL entrar sempre em "Outros". O centro SHALL mostrar o total, e a legenda SHALL trazer rótulo, quantidade e percentual de cada fatia, de modo que a cor nunca seja a única identificação.

#### Scenario: Status com grupo sem informação
- **WHEN** a API informa 200 convênios "Concluído", 120 "Em execução" e 22 sem status
- **THEN** a rosca tem três fatias e a legenda as lista nessa ordem, a última rotulada "Sem informação", cada uma com a quantidade e o percentual, sem "Outros"

#### Scenario: Mais de 5 status
- **WHEN** a API informa 7 status com convênios
- **THEN** a rosca mostra os 5 com mais convênios, do maior para o menor, e uma fatia "Outros" com a soma dos 2 restantes

#### Scenario: Vigência não confirmada vai para Outros
- **WHEN** a API informa "Vigência não confirmada" entre os 5 status com mais convênios
- **THEN** ele não ganha fatia própria, o próximo status sobe para o top 5, e "Outros" inclui a quantidade dele

#### Scenario: Total no centro
- **WHEN** a soma das quantidades por status é 342
- **THEN** o centro da rosca mostra "342" e "convênios"

### Requirement: Animações da interface
O app SHALL animar a entrada das telas, dos cards e dos gráficos, e os números de destaque SHALL contar até o valor. As animações SHALL acontecer mesmo com a preferência do sistema de reduzir movimento ligada. Ao fim de toda animação, a tela SHALL mostrar exatamente o valor da API, e um valor ausente SHALL aparecer como "—" desde o início, sem contagem.

#### Scenario: Número de destaque
- **WHEN** a Visão geral recebe 342 convênios cadastrados
- **THEN** o card conta até "342" e para nesse valor

#### Scenario: Reduzir movimento ligado
- **WHEN** o sistema do usuário tem a opção de reduzir movimento ligada
- **THEN** as telas animam do mesmo jeito

#### Scenario: Valor ausente
- **WHEN** o investido pelo Estado vem nulo da API
- **THEN** o card mostra "—" sem animar uma contagem

### Requirement: Aviso de sistema em desenvolvimento
Enquanto o sistema estiver em desenvolvimento, o app SHALL mostrar, no topo de todas as telas, uma faixa fixa com o texto "Em desenvolvimento (passível de bugs e/ou erros inesperados)".

#### Scenario: Faixa em qualquer tela
- **WHEN** o usuário abre a Visão geral, Municípios, Convênios, o detalhe de um convênio ou Cargas
- **THEN** a faixa de sistema em desenvolvimento aparece no topo

#### Scenario: Faixa na página não encontrada
- **WHEN** o usuário abre um endereço desconhecido
- **THEN** a página de "não encontrado" também mostra a faixa

### Requirement: Lista dos vigentes na Visão geral
A Visão geral SHALL mostrar os convênios dos Vigentes em tabela paginada e ordenável no servidor, com número, município, status, valor total, investido pelo Estado e a repassar. A ordem padrão SHALL ser o valor total, do maior para o menor. O clique numa linha SHALL abrir o detalhe do convênio.

#### Scenario: Ordem padrão
- **WHEN** o usuário abre a Visão geral
- **THEN** a lista dos vigentes é pedida à API com recorte 31 e `ordem=-valor_total`

#### Scenario: Da lista para o detalhe
- **WHEN** o usuário clica na linha do convênio 143/2014 de Paraty na lista dos vigentes
- **THEN** abre o detalhe desse convênio

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

### Requirement: Mapa de convênios por município
A tela Municípios SHALL mostrar, acima da tabela, um mapa do RJ com os 92 municípios pelo contorno. Cada município SHALL ter a cor da faixa de quantidade de convênios dele no recorte selecionado, numa escala de um só matiz, do claro ao escuro. Município sem convênio no recorte SHALL ficar cinza. A quantidade SHALL vir da API do painel e depender só do recorte, não do mês nem do filtro de município.

#### Scenario: Cores seguem o recorte
- **WHEN** o usuário abre Municípios no recorte 31 e Paraty tem 3 convênios nele
- **THEN** Paraty aparece com a cor da faixa que contém 3, e um município sem convênio no recorte 31 aparece cinza

#### Scenario: Trocar o recorte recolore o mapa
- **WHEN** o usuário troca o recorte de Vigentes para Histórico inicial
- **THEN** o mapa passa a usar as quantidades do recorte 342 e a legenda mostra as faixas desse recorte

#### Scenario: O mês não muda o mapa
- **WHEN** o usuário troca o mês de referência
- **THEN** as cores e as quantidades do mapa continuam as mesmas

### Requirement: Faixas e legenda do mapa
O mapa SHALL ter uma legenda com cada faixa e o intervalo de quantidades dela, mais a entrada "Sem convênio" para o cinza. As faixas SHALL ser no máximo 5 e SHALL ser calculadas das quantidades do recorte em uso. Uma faixa SHALL NOT ficar vazia: se o recorte tiver poucas quantidades distintas, cada uma SHALL ser a sua própria faixa.

#### Scenario: Recorte com poucas quantidades distintas
- **WHEN** no recorte em uso os municípios com convênio têm só 1 ou 2 convênios
- **THEN** a legenda mostra as faixas "1" e "2" e "Sem convênio", sem faixas vazias

#### Scenario: Recorte com muitas quantidades
- **WHEN** os municípios do recorte têm de 1 a 40 convênios
- **THEN** a legenda mostra no máximo 5 faixas, que juntas cobrem de 1 a 40 sem lacuna nem sobreposição

### Requirement: Dica e clique no mapa
Ao passar o mouse sobre um município, o mapa SHALL destacar o contorno dele e mostrar uma dica com o nome e a quantidade de convênios no recorte, inclusive quando a quantidade for zero. O clique num município com convênio SHALL abrir a tela Convênios filtrada por aquele município, mantendo o recorte e o mês, como a linha da tabela. Município sem convênio no recorte SHALL NOT ser clicável.

#### Scenario: Dica de um município
- **WHEN** o usuário passa o mouse sobre Niterói, que tem 5 convênios no recorte 89
- **THEN** o contorno de Niterói fica destacado e a dica diz "Niterói · 5 convênios"

#### Scenario: Do mapa para os convênios
- **WHEN** o usuário clica em Niterói no mapa, no recorte 89 e no mês out/2026
- **THEN** abre a tela Convênios com recorte 89, o filtro Niterói e o mesmo mês

#### Scenario: Município sem convênio
- **WHEN** o usuário clica num município sem convênio no recorte
- **THEN** nada é aberto, e a dica informa "0 convênios"

### Requirement: Filtro de município no mapa
Com municípios selecionados no filtro, o mapa SHALL continuar mostrando todos os municípios, com as cores do recorte inteiro. Os municípios fora da seleção SHALL ficar apagados, e os selecionados SHALL manter a cor cheia.

#### Scenario: Paraty selecionado
- **WHEN** o filtro de municípios tem só Paraty
- **THEN** Paraty aparece com a cor cheia da sua faixa, e os outros municípios aparecem apagados, ainda visíveis

### Requirement: Mapa de fundo e contornos
O mapa SHALL usar o OpenStreetMap como fundo, com o crédito "© OpenStreetMap contributors" sempre visível, e esse fundo SHALL ser atenuado para não competir com as cores dos municípios. Os contornos dos municípios SHALL vir de um arquivo do próprio app, não de um serviço externo. Se o fundo não carregar, os contornos e as cores SHALL continuar visíveis.

#### Scenario: Crédito do mapa
- **WHEN** a tela Municípios é exibida
- **THEN** o mapa mostra o crédito do OpenStreetMap

#### Scenario: Sem acesso ao fundo
- **WHEN** o navegador não consegue baixar o mapa de fundo
- **THEN** os municípios continuam aparecendo com as suas cores, e a legenda e a tabela funcionam

### Requirement: Estados de carregamento e erro do mapa
Enquanto as quantidades não chegam, o mapa SHALL mostrar um estado de carregando. Se a API falhar, o mapa SHALL mostrar a mensagem de erro com a opção de tentar de novo. A tabela abaixo SHALL continuar funcionando de forma independente do mapa.

#### Scenario: Falha só no mapa
- **WHEN** o pedido das quantidades do mapa falha e o da tabela não
- **THEN** o mapa mostra o erro com "Tentar de novo", e a tabela é exibida normalmente

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
- separar as linhas por um traço fino, sem alternar o fundo;
- manter o cabeçalho visível durante a rolagem vertical.

Linhas clicáveis SHALL ter destaque ao passar o mouse e ao receber foco pelo teclado.

#### Scenario: Rolar uma tabela longa
- **WHEN** o usuário rola a tabela de convênios para baixo
- **THEN** o cabeçalho das colunas continua visível

#### Scenario: Linha clicável pelo teclado
- **WHEN** o usuário chega a uma linha da lista pelo Tab
- **THEN** a linha fica destacada, e Enter abre o detalhe
