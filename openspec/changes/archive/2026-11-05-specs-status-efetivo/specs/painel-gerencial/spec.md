## MODIFIED Requirements

### Requirement: Situação dos convênios no recorte 342
No recorte `342`, o resumo SHALL trazer a contagem de convênios do filtro por status do convênio e por situação da vigência, lidos da linha da 342 que origina o convênio. Valores não informados MUST ser contados num grupo próprio, com valor nulo. Nos recortes `31` e `89`, esse bloco MUST ser nulo.

#### Scenario: Contagem por status
- **WHEN** o recorte `342` tem 3 convênios com status `Concluído`, 1 `Em execução` e 1 sem status, nenhum deles no recorte `31`
- **THEN** a contagem por status traz 3, 1 e 1 no grupo nulo

## ADDED Requirements

### Requirement: Status Vigente na contagem do resumo
Na contagem por status do resumo, um convênio MUST contar como `Vigente` se, e somente se, estiver no recorte `31`, qualquer que seja o status escrito na planilha. Um convênio fora do `31` que a planilha marca como `Vigente` MUST contar como `Vigência não confirmada`. Os demais status MUST seguir a planilha. Listas e detalhe MUST continuar mostrando o status como escrito na planilha.

#### Scenario: Vigente só nos Vigentes
- **WHEN** a planilha marca 3 convênios como `Vigente`, dos quais só 1 está no recorte `31`, e um convênio marcado `Concluído` está no recorte `31`
- **THEN** a contagem por status traz 2 em `Vigente` e 2 em `Vigência não confirmada`, e `Concluído` não conta o convênio que está no `31`

#### Scenario: Lista mantém o status da planilha
- **WHEN** um convênio fora do recorte `31` está marcado como `Vigente` na planilha
- **THEN** a lista e o detalhe mostram o status `Vigente`, e só a contagem do resumo o trata como `Vigência não confirmada`
