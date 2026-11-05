# Proposal

## Why

Parte das melhorias recentes do painel foi feita fora do OpenSpec, e as specs aceitas ficaram para trás. Hoje `painel-web` descreve o status da Visão geral como barras horizontais com todos os status, e `painel-gerencial` conta o status pelo que a planilha histórica escreve. O código já faz outra coisa nos dois casos. Esta change alinha as specs ao comportamento atual, para que elas voltem a ser o contrato do sistema.

## What Changes

- **Contagem por status no resumo** (`painel-gerencial`): na contagem por status, um convênio conta como "Vigente" se, e somente se, estiver nos Vigentes (recorte 31). Um convênio que a planilha marca como "Vigente" fora dos Vigentes conta como "Vigência não confirmada". Os demais status e a contagem por situação da vigência não mudam. Listas e detalhe continuam mostrando o status como está escrito na planilha.
- **Convênios por status na Visão geral** (`painel-web`): o gráfico de status deixa de ser barras horizontais e vira uma rosca.
  - Os 5 status mais frequentes ganham fatia própria, e o resto é somado em "Outros", que só aparece se houver resto.
  - "Vigência não confirmada" sempre vai para "Outros".
  - O centro mostra o total, e a legenda traz rótulo, quantidade e percentual de cada fatia.
  - O top 10 municípios continua em barras.
- **Animações** (`painel-web`, novo requisito): a interface anima sempre (entrada das telas, contadores, gráficos), mesmo com "reduzir movimento" ligado no sistema, e o valor final é sempre o dado da API.
- **Aviso de sistema em desenvolvimento** (`painel-web`, novo requisito): uma faixa fixa no topo de todas as telas avisa que o sistema está em desenvolvimento.

O comportamento não muda: tudo isso já está implementado. Faltam testes para dois cenários: "Vigência não confirmada" indo para "Outros" na tela, e a faixa de desenvolvimento. Esses testes entram nesta change.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities
- `painel-gerencial`: o cenário de "Situação dos convênios no recorte 342" passa a deixar explícito que os convênios estão fora do `31`. Entra o requisito novo "Status Vigente na contagem do resumo": "Vigente" só nos Vigentes, senão "Vigência não confirmada".
- `painel-web`:
  - "Convênios por status e top 10 municípios" troca as barras de status por uma rosca.
  - Entram os requisitos novos "Rosca de status da Visão geral" (top 5 e "Outros"), "Animações da interface" e "Aviso de sistema em desenvolvimento".

## Impact

- Specs em `openspec/` e dois testes novos em `web/src/telas/painel.test.tsx`. Sem mudança de comportamento, API, dependências nem migração.
- Comportamento já implementado em:
  - `api/app/painel/consultas.py` (`_STATUS_EFETIVO`);
  - `web/src/rosca.ts`, `web/src/componentes/GraficoRosca.tsx`, `web/src/telas/VisaoGeral.tsx`;
  - `web/src/movimento.ts`, `web/src/componentes/Layout.tsx`.
- O comportamento é coberto por `api/tests/test_painel_consultas.py` e pelos testes do `web/`.
