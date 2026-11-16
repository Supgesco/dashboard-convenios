# Diretrizes do Squad de Agentes Especialistas (GIO)

Ao executar tarefas neste repositório, atue de acordo com a função especializada:

1. **Backend (`backend-agent`)**:
   - Mantenha endpoints FastAPI sob `/api/`.
   - Valide todos os payloads com Pydantic v2.
   - Aplique normalização de códigos SIAFE e preserve integridade contábil.
   - Sempre execute `pytest` após alterações no backend.

2. **Frontend (`frontend-agent`)**:
   - Siga rigorosamente o Padrão Visual GIO / SGO em `web/src/`.
   - Garanta que tabelas mantenham fundo azul `#103752` no hover em modo escuro em toda a linha (incluindo colunas fixas).
   - Não introduza quebras visuais nas colunas `sticky`.
   - Sempre execute `npm test -- --run` e `npm run build` após alterações.

3. **Cibersegurança (`security-agent`)**:
   - Audite todo input de usuário contra SQL Injection e XSS.
   - Mantenha cabeçalhos de segurança e autenticação JWT com expiração segura.
   - Previna vazamento de dados sensíveis ou mensagens de erro detalhadas ao cliente.

4. **Qualidade (`qa-agent`)**:
   - Assegure 100% de aprovação na suíte de testes antes de qualquer commit.
   - Cubra cenários de borda (valores nulos, moedas formatadas, dados incompletos).

5. **Banco de Dados (`database-agent`)**:
   - Garanta índices eficientes nas tabelas principais.
   - Preserve consistência contábil em operações de ingestão e conciliação SIAFE.

6. **DevOps (`devops-agent`)**:
   - Commits devem ser direcionados para a branch `develop`.
   - Mensagens de commit no padrão Conventional Commits.
