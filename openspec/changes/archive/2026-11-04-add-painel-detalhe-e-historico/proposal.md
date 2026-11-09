# Proposal

## Why

O próximo passo é o front-end inicial (React + Tailwind), com cinco telas: visão geral, municípios, convênios, detalhe do convênio e cargas. Três delas já têm API pronta. Duas não têm:
- o **detalhe de um convênio** não tem endpoint, porque a lista traz só uma linha por convênio no mês, sem objeto, vigência nem evolução mensal;
- a **tela de cargas** só tem `GET /etl/siafe/status`, que devolve apenas a última execução, e não dá para mostrar histórico.

Esta change fecha essas duas lacunas no back-end antes do front. Assim o front (change seguinte, `add-frontend-inicial`) parte de uma API já especificada e testada, no mesmo padrão das changes anteriores.

## What Changes

- **Novo `GET /painel/convenio`**: detalhe de um convênio, identificado por `numero` e `municipio`. A chave do cruzamento é número + município, e o número sozinho não identifica o convênio.
  - O número aceita as grafias que a carga da planilha aceita (por exemplo, `143/14` → `143/2014`).
  - O município usa a mesma normalização do filtro do painel.
  - Formato inválido ou município não reconhecido gera 422; convênio inexistente gera 404.
- **Conteúdo do detalhe**, limitado ao núcleo:
  - identificação: número, município, fase, status, situação e data final da vigência, objeto, códigos SEOBRAS/SEIOP e recortes a que pertence;
  - código compartilhado: o indicador e os outros convênios que usam o mesmo código;
  - os 4 saldos SIAFE do mês de referência e do mês anterior (`ano`/`mes` com as mesmas regras do painel);
  - os valores contratuais de cada aba em que o convênio está (31 e/ou 89), sem escolher uma delas, com o percentual de execução;
  - a série mensal dos 4 saldos do convênio.
- **Novo `GET /etl/siafe/execucoes`**: histórico das cargas SIAFE, da mais recente para a mais antiga, com os campos do registro de execuções. É paginado com `pagina` e `tamanho` (padrão 20, máximo 100), como as listas do painel, e devolve `total`.
- **Documentação**: a API continua sem autenticação, inclusive no `POST /etl/siafe` que o front vai acionar. O README passa a dizer explicitamente que ela não pode ficar acessível fora da rede interna.

Fora do escopo:
- o front-end, que vem na change `add-frontend-inicial`;
- autenticação e autorização (decisão desta rodada: sem auth por enquanto);
- histórico e upload da planilha (a tela de cargas mostra só a última importação, que o `/painel/resumo` já informa);
- no detalhe: parcelas da aba de Prestação de Contas, processos SEI, observações, registros por conta contábil e falhas do cruzamento;
- CORS (o front usa proxy no desenvolvimento).

## Capabilities

### New Capabilities
<!-- Nenhuma: os dois endpoints estendem capacidades existentes. -->

### Modified Capabilities
- `painel-gerencial`: novo requisito de detalhe do convênio (identificação, saldos do mês, valores contratuais por aba e série mensal), dentro das regras de leitura do painel.
- `siafe-ingestion`: novo requisito de consulta do histórico de execuções, paginado.

## Impact

- **API**:
  - `app/routers/painel.py` ganha `GET /painel/convenio`;
  - `app/routers/etl.py` ganha `GET /etl/siafe/execucoes`;
  - os endpoints existentes não mudam.
- **Consultas**: `app/painel/consultas.py` ganha as consultas do detalhe, que reutilizam as views da `0003` e da `0004`.
- **Banco**: nenhuma migration; não há view, tabela ou coluna nova.
- **Testes**: testes de integração com dados sintéticos para o detalhe e o histórico. Nenhum dado real entra no repositório.
- **Documentação**: `CLAUDE.md` e `api/README.md` descrevem os dois endpoints e o aviso sobre a falta de autenticação.
- **Dependências**: nenhuma.
