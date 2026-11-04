# Proposal

## Why

O banco já tem os saldos do SIAFE (`siafe_flexvision`, uma foto mensal por conta corrente) e o conteúdo da planilha de convênios (8 tabelas `planilha_*`), mas nada liga uma coisa à outra. Por isso o dashboard ainda não sabe responder "quanto falta pagar, comprovar ou aprovar em cada convênio".

O vínculo existe, mas está espalhado:
- A conta corrente do SIAFE é o código de 6 dígitos do convênio.
- Um mesmo convênio pode ter dois códigos, o SEOBRAS antigo e o SEIOP novo, com saldos complementares.
- Os códigos aparecem em abas diferentes e às vezes divergem.
- 65 contas do SIAFE não têm par na planilha, porque os convênios correspondentes estão sem código na aba 342.

Esse cruzamento precisa existir em um lugar só, com regras explícitas, e as falhas de vínculo precisam ficar visíveis para a equipe corrigi-las na planilha.

## What Changes

- **Convênio como unidade**:
  - Cada linha da aba 342 é um convênio, identificado pela chave normalizada `numero_convenio` + `municipio`.
  - A **fase** do convênio vem das abas em que ele aparece: vigente se está na 31, realinhado se está na 89 e histórico nos demais casos.
- **Códigos do convênio**:
  - Para cada tipo de código (SEOBRAS e SEIOP), o código vem da aba mais recente do funil que o tenha preenchido, na ordem 31 > 89 > 342.
  - As abas auxiliares (Prestação de Contas, Realinhado sem Execução, Não Realinhado Expirado, Tomada de Contas e Acompanhamento Especial) só fornecem um código quando o funil não tem nenhum.
  - Um valor diferente do escolhido não sobrescreve nada e vira divergência.
- **Registros mensais do convênio**: cada linha do SIAFE das contas correntes de um convênio, sem agregação, filtrável por ano e mês. Traz a conta contábil (código e nome), o tipo do código e os 4 saldos como vieram do SIAFE, inclusive as linhas zeradas. É o nível mais fino disponível, porque a consulta FlexVision traz saldos mensais, não lançamentos individuais.
- **Saldo do convênio por mês**:
  - Para cada (ano, mês) do SIAFE, o saldo do convênio é a soma, por coluna (a pagar, a comprovar, a aprovar e aprovados), das contas correntes de todos os seus códigos.
  - Há também a quebra por código.
  - Meses nunca são somados entre si, porque cada mês é uma foto do estoque.
- **Qualidade do cruzamento**: uma consulta lista as falhas de vínculo, com o saldo do último mês carregado quando houver:
  - conta do SIAFE sem convênio;
  - convênio sem nenhum código;
  - código que não existe no SIAFE;
  - código divergente entre abas;
  - código atribuído a mais de um convênio;
  - linha de aba que não acha convênio na 342;
  - chave ausente ou repetida na 342.
- **Calculado na leitura**: o cruzamento é feito por views no Postgres, criadas por migration. Nenhuma das duas cargas muda, e o resultado nunca fica defasado quando só uma delas roda.

Fora do escopo:
- endpoints HTTP e telas que consomem as views;
- tabela de-para mantida no sistema (as 65 contas sem par serão corrigidas na planilha);
- avisos de código inexistente no SIAFE durante a importação da planilha, que manteria as duas cargas independentes;
- casamento aproximado de chave ou código;
- valores financeiros da planilha (parcelas, valores repassados) comparados com o SIAFE.

## Capabilities

### New Capabilities
- `convenios-siafe-cruzamento`: vínculo entre os convênios da planilha e as contas correntes do SIAFE. Cobre a identificação do convênio, a fase, a escolha dos códigos com precedência entre abas, os registros mensais das contas do SIAFE de cada convênio, o saldo mensal por convênio e por código, e a lista de falhas de vínculo.

### Modified Capabilities
<!-- Nenhuma: as cargas `siafe-ingestion` e `planilha-convenios-ingestion` não mudam de comportamento; o cruzamento só lê as tabelas que elas gravam. -->

## Impact

- **Banco**: migration `0003` cria as views do cruzamento sobre `siafe_flexvision` e as `planilha_*`. Nenhuma tabela é criada ou alterada.
- **Código**: `api/app/models.py` e o layout não mudam, e as views ficam fora de `Base.metadata` para não confundir o autogenerate.
- **Testes**: novos testes de integração montam dados sintéticos nas tabelas e consultam as views. Nenhum dado real entra no repositório.
- **Dependências**: nenhuma.
