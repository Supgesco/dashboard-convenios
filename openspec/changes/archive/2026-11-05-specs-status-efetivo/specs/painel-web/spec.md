## MODIFIED Requirements

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

## ADDED Requirements

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
