## ADDED Requirements

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
