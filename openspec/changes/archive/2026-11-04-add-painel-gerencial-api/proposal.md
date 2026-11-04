# Proposal

## Why

O banco já tem as duas cargas e o cruzamento entre elas (views da `0003`), mas nada disso está exposto. A única API são os endpoints do ETL SIAFE. A primeira tela do dashboard é uma visão gerencial da carteira de convênios e precisa de endpoints de leitura que entreguem os números prontos: os saldos do SIAFE vinculados aos convênios e os valores contratuais da planilha, com as regras de soma resolvidas no back-end e não no front.

O cruzamento deixou fora do escopo "endpoints HTTP e telas que consomem as views", e este é o próximo passo.

## What Changes

- **Recorte da carteira**: os endpoints recebem o recorte e trabalham com conjuntos aninhados de convênios, 31 ⊂ 89 ⊂ 342:
  - `31`: vigentes (aba 31);
  - `89`: primeiro repasse (aba 89, que inclui os 31);
  - `342`: histórico inicial (todos os convênios da aba 342).

  Cada recorte usa os valores da própria aba, sem misturar abas.
- **Filtro de município**: é um filtro global. Aceita vários municípios, e um nome fora dos 92 municípios do RJ gera erro.
- **Mês de referência**: o padrão é o mês corrente. A resposta informa a data da última carga SIAFE bem-sucedida e a da última importação da planilha.
- **Saldos SIAFE vinculados**: os 4 saldos (a pagar, a comprovar, a aprovar e aprovados) somados no mês sobre os códigos dos convênios do recorte. Cada código conta uma vez, mesmo quando pertence a mais de um convênio. A resposta traz:
  - a variação em relação ao fechamento do mês anterior;
  - a cobertura (saldo vinculado ÷ saldo total do SIAFE no mês), só quando não há filtro de município.
- **Valores contratuais (recortes 31 e 89)**:
  - valor total pactuado, igual ao realinhado quando preenchido e ao inicial nos demais casos, dividido em repasse do Estado e contrapartida do município;
  - investido pelo Estado e a repassar, como a aba registra;
  - percentual de execução, calculado como investido ÷ repasse do Estado sobre as somas.

  Os valores em R$ somam as linhas de continuação do convênio.
- **Situação (recorte 342)**: em vez de valores contratuais, contagens de convênios por status do convênio e por situação da vigência.
- **Novos endpoints**, todos de leitura e com `recorte` e `municipio` (lista):
  - `GET /painel/resumo`: KPIs do mês;
  - `GET /painel/serie`: série mensal dos 4 saldos;
  - `GET /painel/municipios`: ranking por município, que serve também como lista de opções do filtro;
  - `GET /painel/convenios`: lista de convênios com saldo do mês e valores contratuais.

  O ranking e a lista são paginados (`pagina`, `tamanho` com padrão 20 e máximo 100) e ordenáveis no servidor (`ordem`). A série não é paginada.
- **Novas views** em uma migration `0004`, para pertencer ao recorte e consolidar os valores contratuais por convênio. A aritmética fica no SQL, como no cruzamento.

Fora do escopo:
- o front-end (a pasta `web/` continua inexistente);
- a tela operacional de qualidade do cruzamento e endpoints sobre `v_cruzamento_falha`, que aparece só como número de cobertura;
- indicador de consistência do "a repassar" (que fecha com repasse − executado em cerca de 55% dos convênios);
- autenticação e autorização da API;
- cache ou tabelas materializadas (o volume, cerca de 29 mil linhas do SIAFE e 342 convênios, não pede isso);
- exportação (CSV ou planilha).

## Capabilities

### New Capabilities
- `painel-gerencial`: leitura da visão gerencial da carteira de convênios. Cobre o recorte (31, 89, 342), o filtro por municípios, o mês de referência e a data das cargas, os saldos SIAFE vinculados sem dupla contagem com variação mensal e cobertura, os valores contratuais por recorte, a situação do recorte 342, a série mensal, o ranking por município e a lista de convênios.

### Modified Capabilities
<!-- Nenhuma: o cruzamento (`convenios-siafe-cruzamento`) e as duas cargas não mudam de comportamento; o painel só lê as views e tabelas existentes. -->

## Impact

- **API**: novo router `app/routers/painel.py` (prefixo `/painel`), incluído em `app/main.py`. Os endpoints de ETL não mudam.
- **Banco**: migration `0004` cria views novas sobre as views da `0003` e as tabelas `planilha_*`. Nenhuma tabela é criada ou alterada. As views ficam fora de `Base.metadata`, como as da `0003`, e uma futura alteração de `planilha_*` passa a ter de recriar também estas.
- **Testes**: testes de integração com dados sintéticos para as views e os endpoints. Nenhum dado real entra no repositório.
- **Documentação**: `CLAUDE.md` e `api/README.md` passam a descrever o router do painel e a `0004`.
- **Dependências**: nenhuma.
