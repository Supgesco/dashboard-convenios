# Tasks

## 1. Status efetivo na API (painel-gerencial)

- [x] 1.1 Conferir que `api/tests/test_painel_consultas.py::test_status_vigente_e_estar_no_recorte_31` cobre os cenários "Vigente só nos Vigentes" e "Lista mantém o status da planilha". Verificar com `uv run pytest tests/test_painel_consultas.py` em `api/` (precisa de `TEST_DATABASE_URL`; sem ele, os testes são pulados, e isso deve ser registrado).
  - Cobertura conferida na leitura do teste: 2 em "Vigente", 2 em "Vigência não confirmada", e a lista mantém "Concluído". Nesta execução, `TEST_DATABASE_URL` não estava definido: 6 testes passaram e 41 de integração foram pulados.

## 2. Rosca de status (painel-web)

- [x] 2.1 Adicionar em `web/src/telas/painel.test.tsx` um teste do cenário "Vigência não confirmada vai para Outros", na tela da Visão geral, com fixture sintética. Verificar com `npx vitest run src/telas/painel.test.tsx`.
- [x] 2.2 Conferir que os testes existentes cobrem os cenários "Status com grupo sem informação", "Mais de 5 status", "Total no centro" e "Top 10", e completar o que faltar no mesmo arquivo. Verificar com `npx vitest run src/telas/painel.test.tsx src/componentes/componentes.test.tsx`.
  - Os testes existentes já cobriam os quatro cenários: "Sem informação", 7 status virando 5 fatias mais "Outros", o total no centro e o top 10. Não faltou nada.

## 3. Animações e faixa de desenvolvimento (painel-web)

- [x] 3.1 Adicionar em `web/src/telas/painel.test.tsx` um teste de que a faixa "Em desenvolvimento (passível de bugs e/ou erros inesperados)" aparece numa tela comum e na página de "não encontrado". Verificar com `npx vitest run src/telas/painel.test.tsx`.
  - O teste ficou em `web/src/App.test.tsx`, no bloco "navegação", junto ao de "não encontrado". Ele cobre as 5 telas e um endereço desconhecido.
- [x] 3.2 Conferir que os testes de `NumeroAnimado` em `web/src/componentes/componentes.test.tsx` cobrem o valor final exato e o nulo como "—". Verificar com `npx vitest run src/componentes/componentes.test.tsx`.

## 4. Verificação geral

- [x] 4.1 Rodar `npm test`, `npm run lint` e `npm run build` em `web/` e confirmar que tudo passa.
- [x] 4.2 Rodar `openspec validate specs-status-efetivo --strict` e confirmar que a change é válida.

## Workflow follow-up

- Arquivar a change com `/opsx:archive`, sincronizando as specs `painel-web` e `painel-gerencial`.
- Conferir no `openspec/specs/painel-web/spec.md` que o requisito de status não fala mais em barras.
