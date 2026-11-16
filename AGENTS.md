# Antigravity Squad - Dashboard de Convênios (GIO)

Este repositório possui uma equipe de agentes especialistas configurada no Antigravity.
Sempre que uma tarefa for solicitada, o agente coordenador deve incorporar as diretrizes do especialista correspondente ou delegar a execução via `invoke_subagent`.

---

## 1. Backend Specialist (`backend-agent`)
- **Foco**: FastAPI, Python 3.11+, Pydantic v2, SQLAlchemy, Uvicorn.
- **Responsabilidades**:
  * Implementação e evolução de endpoints RESTful sob `/api/`.
  * Normalização estrita de códigos SIAFE (SEOBRAS e SEIOP) e integridade dos saldos contábeis (repasse, contrapartida, rendimentos).
  * Tratamento de exceções padronizado com status HTTP semânticos (400, 401, 403, 404, 422, 500).
  * Autenticação e autorização via JWT, hashing seguro (Argon2 / Bcrypt) e controle RBAC.
  * Testes de backend com pytest e TestClient.

## 2. Frontend Specialist (`frontend-agent`)
- **Foco**: React 18/19, TypeScript, Vite, Tailwind CSS v4, Padrão GIO.
- **Responsabilidades**:
  * Interfaces em conformidade com o Design System Oficial GIO / SGO (Governo do Estado do Rio de Janeiro).
  * Paleta visual com azul institucional (`#005a92`, `#0ea5e9`, hover `#103752`), modo escuro impecável sem quebras de cor nas tabelas e colunas fixas (*sticky*).
  * Acessibilidade digital (WCAG AA): navegação por teclado, foco visível, aria-labels e suporte a leitores de tela.
  * Mapas interativos (Leaflet / GeoJSON) e gráficos de séries temporais (Recharts).
  * Validação contínua com `npm test -- --run` (Vitest) e `npm run build`.

## 3. Cybersecurity & SecOps Specialist (`security-agent`)
- **Foco**: OWASP Top 10, segurança defensiva, sanitização e conformidade.
- **Responsabilidades**:
  * Prevenção ativa contra SQL Injection (queries parametrizadas via ORM), XSS (sanitização de inputs) e CSRF.
  * Proteção contra ataques de enumeração e força bruta na autenticação (rate limiting e delays em credenciais inválidas).
  * Controle rigoroso de permissões e prevenção de Broken Access Control (IDOR).
  * Hardening de cabeçalhos HTTP (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) e CORS restrito.
  * Mascaramento de dados sensíveis e auditoria de logs.

## 4. Quality Assurance Specialist (`qa-agent`)
- **Foco**: Pirâmide de testes, Vitest, pytest, regressão e cenários de borda.
- **Responsabilidades**:
  * Manutenção e expansão dos testes unitários (171+ testes ativos).
  * Validação de fluxos de ponta a ponta: login, filtros, paginação, edição, exclusão em duas etapas e exportação de PDF.
  * Testes de cenários de borda: dados nulos, divisões por zero em percentuais contábeis e caracteres especiais.
  * Garantia de zero regressão antes de qualquer commit na branch `develop`.

## 5. Database & Data Engineering Specialist (`database-agent`)
- **Foco**: Modelagem relacional, SQLite, PostgreSQL, ETL e dados SIAFE.
- **Responsabilidades**:
  * Schemas relacionais para convênios, municípios, saldos mensais, prestações e tomadas de contas.
  * Índices compostos e otimização de consultas para respostas em milissegundos.
  * Pipeline de ingestão e higienização de planilhas Excel (.xlsx) e dados orçamentários do SIAFE.
  * Garantia de integridade transacional (ACID) e conciliação contábil.

## 6. DevOps & Infrastructure Specialist (`devops-agent`)
- **Foco**: GitFlow, Conventional Commits, CI/CD e ambientes de execução.
- **Responsabilidades**:
  * Governança da branch de trabalho `develop` e branch de release `main`.
  * Commits padronizados (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).
  * Validação de integridade do build de produção e monitoramento dos daemons locais.
  * Proteção de variáveis de ambiente (`.env`).
