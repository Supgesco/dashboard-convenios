import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../autenticacao'

const DOMINIO_INSTITUCIONAL = '@obras.rj.gov.br'

function extrairUsuarioEmail(valor: string): string {
  return valor.trim().replace(/@.*$/, '')
}

function montarEmailInstitucional(valor: string): string {
  const usuario = extrairUsuarioEmail(valor)
  return usuario ? `${usuario}${DOMINIO_INSTITUCIONAL}` : ''
}

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

  const handleSolicitarAcesso = (e: FormEvent) => {
    e.preventDefault()
    setSolicitacaoEnviada(true)
  }

  const voltarParaLogin = () => {
    setModoSolicitar(false)
    setSolicitacaoEnviada(false)
    setErro(null)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 p-4 sm:p-6 lg:p-8">
      {/* Luz ambiente de fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-1/4 -top-1/4 size-[600px] rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 size-[600px] rounded-full bg-cyan-600/10 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Cabeçalho com nova identidade visual dinâmica GIO · GIOFIN */}
        <div className="mb-8 text-center">
          <div className="group relative mx-auto mb-5 inline-flex items-center justify-center">
            {/* Halo luminoso dinâmico */}
            <div
              aria-hidden="true"
              className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 opacity-35 blur-xl transition duration-500 group-hover:opacity-60"
            />
            {/* Emblema principal GIO / GIOFIN */}
            <div className="relative flex size-20 items-center justify-center rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-900/95 to-blue-950 p-3.5 shadow-2xl ring-1 ring-cyan-400/30 transition duration-300 group-hover:scale-[1.03]">
              <svg
                viewBox="0 0 64 64"
                className="size-full overflow-visible"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="gio-pillar-1" x1="12" y1="18" x2="22" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                  </linearGradient>
                  <linearGradient id="gio-pillar-2" x1="27" y1="12" x2="37" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="#2563EB" />
                  </linearGradient>
                  <linearGradient id="gio-pillar-3" x1="42" y1="22" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#34D399" />
                    <stop offset="100%" stopColor="#0891B2" />
                  </linearGradient>
                  <linearGradient id="giofin-arc" x1="8" y1="44" x2="56" y2="14" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
                    <stop offset="45%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="#34D399" />
                  </linearGradient>
                </defs>

                {/* Arco orbital de fundo (ecossistema integrado GIO + GIOFIN) */}
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  stroke="url(#giofin-arc)"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                  className=" opacity-50"
                />

                {/* Pilares estruturais (GIO - Gestão Integrada de Obras) */}
                <rect x="13" y="30" width="8" height="20" rx="2.5" fill="url(#gio-pillar-1)" opacity="0.9" />
                <rect x="28" y="20" width="8" height="30" rx="2.5" fill="url(#gio-pillar-2)" />
                <rect x="43" y="13" width="8" height="37" rx="2.5" fill="url(#gio-pillar-3)" />

                {/* Base estrutural contínua */}
                <path
                  d="M10 50H54"
                  stroke="#38BDF8"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeOpacity="0.65"
                />

                {/* Curva ascendente dinâmica de fluxo financeiro (GIOFIN) */}
                <path
                  d="M10 42C20 41 26 34 33 27C39 21 45 16 54 11"
                  stroke="url(#giofin-arc)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d="M46 10.5H54.5V19"
                  stroke="#34D399"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Nós luminosos de conexão */}
                <circle cx="17" cy="39.5" r="2.5" fill="#E0F2FE" />
                <circle cx="32" cy="27.5" r="3" fill="#ECFEFF" stroke="#06B6D4" strokeWidth="1.5" />
                <circle cx="54" cy="11" r="3" fill="#A7F3D0" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Painel de Convênios</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Governo do Estado do Rio de Janeiro
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            SEIOP · Subsecretaria de Tecnologia da Informação (SUBTSI)
          </p>
        </div>

        {/* Cartão de Login / Solicitação de Acesso */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-7 shadow-2xl backdrop-blur-xl sm:p-10">
          {!modoSolicitar ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {erro && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{erro}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="campo-email" className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                    E-mail institucional
                  </label>
                  <div
                    onClick={() => document.getElementById('campo-email')?.focus()}
                    className="mt-1.5 flex cursor-text items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3.5 text-base shadow-inner focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
                  >
                    <input
                      id="campo-email"
                      type="text"
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(extrairUsuarioEmail(e.target.value))}
                      placeholder="admin"
                      className="min-w-0 flex-1 bg-transparent p-0 text-base font-medium text-white placeholder-slate-500 focus:outline-none"
                    />
                    <span
                      aria-hidden="true"
                      className="shrink-0 select-none text-base font-semibold tracking-wide text-cyan-400"
                    >
                      {DOMINIO_INSTITUCIONAL}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="campo-senha" className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                      Senha de acesso
                    </label>
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      id="campo-senha"
                      type={mostrarSenha ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3.5 pr-10 text-base text-white placeholder-slate-500 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={mostrarSenha ? 'Ocultar senha' : 'Exibir senha'}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                      onClick={() => setMostrarSenha((s) => !s)}
                    >
                      {mostrarSenha ? (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                          <path
                            fillRule="evenodd"
                            d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                          <path
                            fillRule="evenodd"
                            d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={processando}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
                >
                  {processando ? (
                    <>
                      <svg className="size-4 animate-spin text-slate-900" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Autenticando…</span>
                    </>
                  ) : (
                    <span>Acessar Painel</span>
                  )}
                </button>
              </form>

              <div className="mt-6 border-t border-slate-800 pt-5 text-center">
                <p className="mb-3 text-xs text-slate-400">Ainda não possui credenciais de acesso?</p>
                <button
                  type="button"
                  onClick={() => {
                    setModoSolicitar(true)
                    setSolicitacaoEnviada(false)
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/50 px-4 py-2.5 text-xs font-semibold text-cyan-300 transition hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                >
                  Solicitar acesso
                </button>
              </div>
            </>
          ) : solicitacaoEnviada ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Solicitação enviada</h2>
              <p className="text-xs leading-relaxed text-slate-300">
                Seu pedido de credencial para{' '}
                <strong className="text-white">{montarEmailInstitucional(emailSolicitante)}</strong> foi encaminhado à
                equipe da SUBTSI / SEIOP.
              </p>
              <button
                type="button"
                onClick={voltarParaLogin}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSolicitarAcesso} className="space-y-4">
              <div className="mb-2">
                <h2 className="text-base font-semibold text-white">Solicitar acesso</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Preencha seus dados institucionais para liberação pela SUBTSI.
                </p>
              </div>

              <div>
                <label htmlFor="solicitar-nome" className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  Nome completo
                </label>
                <input
                  id="solicitar-nome"
                  type="text"
                  required
                  value={nomeSolicitante}
                  onChange={(e) => setNomeSolicitante(e.target.value)}
                  placeholder="Nome do servidor"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label htmlFor="solicitar-email" className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  E-mail institucional
                </label>
                <div
                  onClick={() => document.getElementById('solicitar-email')?.focus()}
                  className="mt-1.5 flex cursor-text items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3.5 text-base shadow-inner focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
                >
                  <input
                    id="solicitar-email"
                    type="text"
                    required
                    value={emailSolicitante}
                    onChange={(e) => setEmailSolicitante(extrairUsuarioEmail(e.target.value))}
                    placeholder="nome.sobrenome"
                    className="min-w-0 flex-1 bg-transparent p-0 text-base font-medium text-white placeholder-slate-500 focus:outline-none"
                  />
                  <span
                    aria-hidden="true"
                    className="shrink-0 select-none text-base font-semibold tracking-wide text-cyan-400"
                  >
                    {DOMINIO_INSTITUCIONAL}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="solicitar-setor" className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  Setor / Subsecretaria
                </label>
                <input
                  id="solicitar-setor"
                  type="text"
                  required
                  value={setorSolicitante}
                  onChange={(e) => setSetorSolicitante(e.target.value)}
                  placeholder="Ex.: SEIOP / Fiscalização de Convênios"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={voltarParaLogin}
                  className="w-1/2 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="w-1/2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110"
                >
                  Enviar solicitação
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Rodapé de Governança */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Acesso restrito e monitorado · Subtsi / SEIOP - RJ
        </p>
      </div>
    </div>
  )
}
