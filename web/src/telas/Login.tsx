import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

import govLogo from '../assets/govlogo.png'
import logoGio from '../assets/LogoGio.png'
import logoGioBranca from '../assets/LogoGioBranca.png'
import { useAuth } from '../autenticacao'
import { FundoGio } from '../componentes/FundoGio'

const DOMINIO_INSTITUCIONAL = '@obras.rj.gov.br'

/** Remove o domínio digitado para padronizar a identificação institucional. */
function extrairUsuarioEmail(valor: string): string {
  return valor.trim().replace(/@.*$/, '')
}

/** Monta o e-mail completo com o domínio oficial da SEIOP. */
function montarEmailInstitucional(valor: string): string {
  const usuario = extrairUsuarioEmail(valor)
  return usuario ? `${usuario}${DOMINIO_INSTITUCIONAL}` : ''
}

const RECURSOS_GIO = [
  {
    titulo: 'Gestão Integrada de Convênios',
    descricao: 'Acompanhe saldos SIAFE, vigências e movimentações financeiras em tempo real.',
  },
  {
    titulo: 'Mapeamento Territorial',
    descricao: 'Visualize investimentos estaduais por município e filtre rapidamente por região.',
  },
  {
    titulo: 'Prestação e Tomada de Contas',
    descricao: 'Controle prazos, ocorrências e pendências com emissão direta de relatórios em PDF.',
  },
]

const INDICADORES_GIO = [
  { rotulo: 'Integração SIAFE', valor: 'Dados Oficiais' },
  { rotulo: 'Cobertura', valor: '92 Municípios' },
  { rotulo: 'Relatórios', valor: 'Exportação PDF' },
]

/** Tela institucional de autenticação no padrão visual GIO (SEIOP). */
export function TelaLogin() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [processando, setProcessando] = useState(false)

  const [modoSolicitar, setModoSolicitar] = useState(false)
  const [nomeSolicitante, setNomeSolicitante] = useState('')
  const [emailSolicitante, setEmailSolicitante] = useState('')
  const [setorSolicitante, setSetorSolicitante] = useState('')
  const [solicitacaoEnviada, setSolicitacaoEnviada] = useState(false)

  const { login } = useAuth()
  const navegar = useNavigate()
  const location = useLocation()

  // Retorna para a página onde o usuário tentou acessar, ou vai para a raiz
  const destino = (location.state as { from?: { pathname: string; search: string } })?.from
    ? `${(location.state as { from: { pathname: string; search: string } }).from.pathname}${(location.state as { from: { pathname: string; search: string } }).from.search}`
    : '/'

  /** Autentica o usuário usando o e-mail institucional padronizado. */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null)
    setProcessando(true)

    try {
      const emailCompleto = montarEmailInstitucional(email)
      const res = await login(emailCompleto, senha)
      if (res.sucesso) {
        navegar(destino, { replace: true })
      } else {
        setErro(res.erro)
      }
    } catch {
      setErro('Ocorreu um erro inesperado ao conectar ao serviço de autenticação.')
    } finally {
      setProcessando(false)
    }
  }

  /** Registra o pedido de acesso no modo de solicitação. */
  const handleSolicitarAcesso = (e: FormEvent) => {
    e.preventDefault()
    setSolicitacaoEnviada(true)
  }

  /** Retorna do fluxo de solicitação de acesso para o formulário principal. */
  const voltarParaLogin = () => {
    setModoSolicitar(false)
    setSolicitacaoEnviada(false)
    setErro(null)
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden">
      <FundoGio />

      {/* Cabeçalho institucional padrão GIO */}
      <header className="relative z-10 w-full px-6 py-4 md:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={govLogo}
              alt="Logo Governo do Estado"
              className="h-12 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
            />
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-md sm:flex">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs font-medium text-white/90">
              Sistema Oficial • GIO Convênios
            </span>
          </div>
        </div>
      </header>

      {/* Conteúdo principal em duas colunas */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-6 md:px-12">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Coluna esquerda: informações institucionais */}
          <div className="hidden space-y-8 text-white lg:col-span-6 lg:block">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-md">
                <span className="text-xs font-semibold uppercase tracking-wider text-orange-300">
                  Portal Corporativo GIO
                </span>
              </div>

              <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
                GIO <span className="text-orange-400">Convênios</span>
              </h1>

              <p className="max-w-lg text-lg leading-relaxed text-white/80">
                Plataforma integrada para acompanhamento financeiro, execução de convênios,
                prestação e tomada de contas da Secretaria de Infraestrutura de Obras Públicas.
              </p>
            </div>

            <div className="space-y-4">
              {RECURSOS_GIO.map((item) => (
                <div
                  key={item.titulo}
                  className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">{item.titulo}</h2>
                    <p className="text-sm text-white/70">{item.descricao}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-6 border-t border-white/10 pt-6 text-sm text-white/70">
              {INDICADORES_GIO.map((indicador) => (
                <div key={indicador.rotulo}>
                  <span className="block text-xs uppercase tracking-wider text-white/50">
                    {indicador.rotulo}
                  </span>
                  <span className="font-semibold text-white">{indicador.valor}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna direita: card de login / solicitação de acesso */}
          <div className="lg:col-span-6">
            <div className="mx-auto w-full max-w-md">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
                {/* Faixa laranja característica do GIO */}
                <div className="h-1.5 w-full bg-orange-500/90" />

                <div className="p-8 sm:p-10">
                  <div className="mb-8 text-center">
                    <div className="mb-5 flex justify-center">
                      <img
                        src={logoGio}
                        alt="GIO - Gestão Integrada de Obras"
                        className="block h-14 w-auto object-contain dark:hidden"
                      />
                      <img
                        src={logoGioBranca}
                        alt="GIO - Gestão Integrada de Obras"
                        className="hidden h-14 w-auto object-contain dark:block"
                      />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 lg:hidden dark:text-white">
                      GIO Convênios
                    </p>
                    <h2 className="hidden text-2xl font-bold text-gray-900 lg:block dark:text-white">
                      {modoSolicitar ? 'Solicitar acesso' : 'Bem-vindo de volta'}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {modoSolicitar
                        ? 'Preencha seus dados para liberação do acesso institucional'
                        : 'Faça login para acessar o GIO Convênios'}
                    </p>
                  </div>

                  {!modoSolicitar ? (
                    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                      {erro && (
                        <div
                          role="alert"
                          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-300"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="mt-0.5 h-4 w-4 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4M12 16h.01" />
                          </svg>
                          <span>{erro}</span>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="campo-email"
                          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          E-mail institucional
                        </label>
                        <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-300 bg-white transition-all focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800">
                          <input
                            id="campo-email"
                            type="text"
                            inputMode="email"
                            autoComplete="username"
                            required
                            value={email}
                            onChange={(e) => setEmail(extrairUsuarioEmail(e.target.value))}
                            placeholder="nome.sobrenome"
                            className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white dark:placeholder:text-gray-500"
                          />
                          <span
                            aria-hidden="true"
                            className="flex shrink-0 select-none items-center border-l border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400"
                          >
                            {DOMINIO_INSTITUCIONAL}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="campo-senha"
                          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Senha de acesso
                        </label>
                        <div className="relative">
                          <input
                            id="campo-senha"
                            type={mostrarSenha ? 'text' : 'password'}
                            autoComplete="current-password"
                            required
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-3.5 pr-11 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                          />
                          <button
                            type="button"
                            onClick={() => setMostrarSenha((prev) => !prev)}
                            aria-label={mostrarSenha ? 'Ocultar senha' : 'Exibir senha'}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            {mostrarSenha ? (
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={processando}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-gray-900"
                      >
                        {processando ? 'Autenticando...' : 'Acessar Painel'}
                      </button>

                      <div className="border-t border-gray-200 pt-4 text-center dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => {
                            setModoSolicitar(true)
                            setErro(null)
                          }}
                          className="text-xs font-medium text-gray-600 transition-colors hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400"
                        >
                          Não tem acesso? <span className="underline">Solicitar acesso</span>
                        </button>
                      </div>
                    </form>
                  ) : solicitacaoEnviada ? (
                    <div className="space-y-4 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-6 w-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          Solicitação registrada
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Sua solicitação foi encaminhada para a equipe responsável pela gestão de
                          acessos da SEIOP.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={voltarParaLogin}
                        className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                      >
                        Voltar para o login
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSolicitarAcesso} className="space-y-4">
                      <div>
                        <label
                          htmlFor="campo-nome-solicitante"
                          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Nome completo
                        </label>
                        <input
                          id="campo-nome-solicitante"
                          type="text"
                          required
                          value={nomeSolicitante}
                          onChange={(e) => setNomeSolicitante(e.target.value)}
                          placeholder="Seu nome completo"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="campo-email-solicitante"
                          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          E-mail institucional
                        </label>
                        <input
                          id="campo-email-solicitante"
                          type="email"
                          required
                          value={emailSolicitante}
                          onChange={(e) => setEmailSolicitante(e.target.value)}
                          placeholder="nome.sobrenome@obras.rj.gov.br"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="campo-setor-solicitante"
                          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Setor / Diretoria
                        </label>
                        <input
                          id="campo-setor-solicitante"
                          type="text"
                          required
                          value={setorSolicitante}
                          onChange={(e) => setSetorSolicitante(e.target.value)}
                          placeholder="Ex.: Superintendência de Convênios"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={voltarParaLogin}
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Voltar para o login
                        </button>
                        <button
                          type="submit"
                          className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                        >
                          Enviar solicitação
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Rodapé institucional padrão GIO */}
      <footer className="relative z-10 w-full px-6 py-4 text-center">
        <p className="text-xs text-white/60">
          Secretaria de Infraestrutura de Obras Públicas (SEIOP) • Todos os direitos reservados •
          Ambiente seguro
        </p>
      </footer>
    </div>
  )
}
