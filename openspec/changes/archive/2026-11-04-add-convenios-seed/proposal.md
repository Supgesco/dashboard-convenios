# Proposal

## Why

Hoje a situação dos convênios do programa Somando Forças só existe na planilha geral mantida pela equipe ("Planilha Geral Somando Forças – Situação com prestação de contas", revisão de 11/08/2026). O SIAFE já é carregado no banco, mas esses dados não. Sem eles no Postgres o dashboard não consegue cruzar cadastro, realinhamentos, prestação de contas e tomada de contas com os saldos do SIAFE.

Como foi digitada à mão, a planilha também não serve para consulta direta. O mesmo município aparece com várias grafias ("São J Vale do Rio Preto", "SÃO JOSÉ DO VALE RIO PRETO"), o mesmo convênio como "143/14" e "143/2014", o mesmo código como 7783 e "007783", e as categorias variam ("Vigente " e "vigente"). Algumas abas têm colunas deslocadas, e convênios que ocupam várias linhas mescladas. Por isso a carga precisa de uma etapa de transformação, virando um ETL completo, e não uma cópia.

## What Changes

- Novo **ETL sob demanda** da planilha, em três etapas:
  - **Extração**: lê o `.xlsx` e valida o layout (abas, cabeçalhos, fim dos dados). Lê 8 das 9 abas; a `Planilha2` (rascunho) é ignorada. Só entram linhas de dados: títulos, totais, quadros-resumo, legendas e notas ficam de fora.
  - **Transformação**:
    - Limpeza de texto: espaços e quebras de linha; `-`, `.` e `#REF!` viram nulo.
    - Categorias com forma canônica, e Realinhado como booleano.
    - Município com o nome oficial entre os 92 do RJ.
    - Número do convênio no formato `NNN/AAAA`.
    - Códigos SEOBRAS/SEIOP com 6 dígitos e o mesmo nome de coluna em todas as abas.
    - Linhas de continuação herdam a identificação do convênio, mas não os valores, para não haver dupla contagem.
    - Correção das colunas deslocadas nas abas 342 e ACOMPANHAMENTO.
    - Descarte das colunas repetidas da aba 31.
    - Datas, valores e quantidades tipados.
  - **Carga**: uma tabela normalizada por aba. Não há camada crua: o original só fica na planilha e nos avisos.
- **Nada se perde em silêncio**: valor que a transformação não aproveita vira nulo, ou fica gravado limpo no caso de categoria ou município, e gera um aviso com aba, célula, motivo e valor original.
- **Overwrite atômico**: cada carga bem-sucedida substitui as 8 tabelas numa única transação. Só roda uma por vez, com advisory lock próprio, independente da carga do SIAFE.
- **Registro auditável** de cada execução (arquivo, hash, status, contagem por aba, avisos, erro), gravado em transações separadas.
- **Disparo por linha de comando**: `uv run python -m app.etl.planilha <arquivo.xlsx>`, com código de saída 0 em sucesso e diferente de zero em falha.

Fora do escopo: upload via HTTP; cores e comentários das células; modelo integrado (uma tabela única de convênios unindo as abas); código IBGE do município; vínculo com `siafe_flexvision`. A chave normalizada (número do convênio e códigos SEOBRAS/SEIOP) prepara esses passos, que podem virar mudanças próprias.

## Capabilities

### New Capabilities
- `planilha-convenios-ingestion`: ETL sob demanda da planilha geral de convênios (todas as abas exceto a Planilha2), com validação de layout, normalização dos dados, tabelas tipadas por aba, overwrite atômico e registro de cada execução.

### Modified Capabilities
<!-- Nenhuma: a carga SIAFE (`siafe-ingestion`) não muda de comportamento; o ETL da planilha usa tabelas, lock e registro próprios. -->

## Impact

- **Código novo** em `api/app/`:
  - `planilha/`: layout declarativo por aba, extração, transformação e domínios (municípios do RJ e vocabulários das categorias).
  - `etl/planilha.py`: orquestração + CLI.
  - `app/models.py` ganha as 8 tabelas e a tabela de importações.
- **Banco**: migration Alembic `0002` criando `planilha_importacao` e as 8 tabelas `planilha_*`. Nenhuma tabela existente é alterada.
- **Dependências**: nenhuma nova (`openpyxl` já está no projeto).
- **Testes**: fixtures `.xlsx` sintéticos gerados com openpyxl nos testes; nenhum dado real versionado. O guard do `conftest.py`, que recusa um banco com dados, passa a olhar também as tabelas da planilha.
- **Docs**: `CLAUDE.md` e `api/README.md` ganham o comando do ETL.
