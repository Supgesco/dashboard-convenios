# Spec Delta

## ADDED Requirements

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
