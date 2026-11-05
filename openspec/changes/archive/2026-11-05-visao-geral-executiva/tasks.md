# Tasks

## 0. Ponto de partida

- [X] 0.1 Pedir ao usuário que aprove o commit do restyle atual (`style(web): ...`, separado do `CLAUDE.md`) e fazê-lo antes de mexer nesta change. Verificação: `git status` limpo em `web/src`, com o restyle no histórico.

## 1. API: percentual do investido sobre o valor total

- [x] 1.1 Em `api/app/painel/consultas.py`:
  - acrescentar `investido_sobre_total_pct` (`round(100 * soma(investido_estado) / nullif(soma(valor_total), 0), 2)`) em `_SOMA_CONTRATUAIS`, na consulta da lista e na do detalhe;
  - levar a coluna do CTE contratual ao ranking;
  - incluí-la em `ORDEM_RANKING` e `ORDEM_LISTA`.

  Verificação: testes em `tests/test_painel_consultas.py` para o quociente de somas (350 ÷ 500 = 70%), a diferença para o `execucao_pct` (40 vs 50), o valor total zero ou nulo (nulo) e `ordem=-investido_sobre_total_pct` com nulos por último, passando com `TEST_DATABASE_URL`.
- [x] 1.2 Em `api/app/routers/painel.py`, acrescentar `investido_sobre_total_pct: float | None` ao modelo `Contratual`. Verificação: teste em `tests/test_routers_painel.py` mostrando que o campo aparece no resumo (31), no ranking, na lista e nos blocos do detalhe, e que o resumo 342 continua com `contratual` nulo; `uv run pytest` verde.
- [x] 1.3 Regenerar `web/src/api/openapi.json` e `schema.d.ts` com `npm run api:tipos`, e acrescentar o campo às fixtures sintéticas de `web/src/teste/`. Verificação: `npm run build` (typecheck) e `npm test` verdes, e o diff dos tipos mostrando só o campo novo.

## 2. Tela Convênios com os cards de saldo

- [x] 2.1 Em `web/src/telas/Convenios.tsx`:
  - chamar `useResumo(filtros, ref.mes)` e mostrar `CartoesSaldo` acima da tabela, com o aviso de "mês sem dados" e o último mês disponível;
  - a falha do resumo aparece no lugar dos cards, com o botão de tentar de novo, sem esconder a lista.

  Verificação: em `telas/painel.test.tsx` (bloco Convênios), passar a valer aqui os testes da variação (sinal e seta, "—" sem mês anterior), do mês padrão `ultimo_mes_disponivel`, do mês sem dados e da falha do resumo com a lista visível, todos verdes.

## 3. Visão geral nova

- [x] 3.1 Extrair de `Situacao` (`VisaoGeral.tsx`) um componente `BarrasHorizontais({ itens, rotulo })`:
  - uma `section` com `aria-label`;
  - cada item com rótulo, barra `aria-hidden` proporcional ao maior valor e número escrito;
  - `null` vira "Sem informação".

  Verificação: teste em `componentes/componentes.test.tsx` cobrindo a ordem dada, a largura proporcional (o maior com 100%), o rótulo "Sem informação" e a lista vazia.
- [x] 3.2 Tirar `/` de `TELAS_COM_FILTROS` em `componentes/Layout.tsx` e trocar o subtítulo da barra lateral "SIAFE · Planilha geral" por um texto sem "planilha", como "Fazenda RJ · SIAFE". Verificação: testes mostrando que a Visão geral não tem `group "Recorte"` e que, ao ir de Convênios (recorte 89 + Paraty) para a Visão geral e voltar pelo menu, os filtros continuam na URL.
- [x] 3.3 Reescrever `web/src/telas/VisaoGeral.tsx` conforme o design (decisões 1, 2 e 6):
  - cards Cadastrados (342, variante escura, "em N municípios"), Vigentes (31, "em N municípios"), Valor total conveniado, Investido pelo Estado (com `percentual(investido_sobre_total_pct)` e `BarraProgresso`) e A repassar;
  - `BarrasHorizontais` de status (342) e do top 10 (`/painel/municipios?recorte=342&ordem=-convenios&tamanho=10`);
  - lista dos vigentes com `TabelaPaginada` (número, município, status, valor total, investido, a repassar), ordem padrão `-valor_total`, `pagina` e `ordem` na URL e clique abrindo o detalhe sem mês;
  - rodapé com as datas das cargas.
  - Cada bloco tem o seu próprio carregando e erro.
  - Os pedidos não levam recorte, município nem mês da URL.

  Verificação: reescrever o bloco "Visão geral" de `telas/painel.test.tsx` com os cenários da spec: os cards com 342/83 e 31/14 vindos da fixture; o percentual 37,0% com a barra e "—" sem a barra quando nulo; o status com "Sem informação" na ordem; o top 10 pedido com `ordem=-convenios&tamanho=10`; a lista pedida com `recorte=31&ordem=-valor_total`; a URL com `recorte=89&municipio=Paraty` sem mudar os pedidos; a ausência dos saldos SIAFE, da cobertura e do gráfico mensal; e a falha só na lista sem esconder o resto. `npm test` verde.
- [x] 3.4 Remover o que ficou sem uso: `Cobertura` e o `Situacao` antigo da Visão geral, e `useSerie` se nenhuma tela o chamar mais (o `GraficoSerie` e o `BlocoContratual` continuam no detalhe). Verificação: `npm run lint` sem avisos novos e `npm run build` verde.
- [x] 3.5 Atualizar `web/README.md` (o que cada tela mostra) e a descrição das telas no `CLAUDE.md`, se citar a Visão geral. Verificação: os textos batem com as telas, conferido lendo os dois arquivos.

## 4. Verificação integrada

- [x] 4.1 Rodar `uv run pytest` em `api/`, e `npm test`, `npm run lint` e `npm run build` em `web/`. Verificação: tudo verde, sem avisos novos de lint.
- [x] 4.2 Com a API (8010) e o dev server (5180) no ar, tirar capturas de `/` e `/convenios` em tela larga e estreita, guardadas no scratchpad e nunca no repositório, porque têm dados reais. Verificação: conferir na captura os 5 cards, os dois gráficos de barras com números, a lista dos vigentes, a ausência da barra de filtros na Visão geral e os 4 cards de saldo em Convênios.

## Workflow follow-up

- Fazer os commits (API e front separados, Conventional Commits em português) quando o usuário pedir.
- Arquivar a change com `/opsx:archive` depois da revisão.
