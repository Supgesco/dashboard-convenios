import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'

import logoGio from '../assets/LogoGio.png'
import logoGioBranca from '../assets/LogoGioBranca.png'
import oGio from '../assets/O-GIO.png'
import oGioBranca from '../assets/O-GIOBranca.png'
import { useAuth } from '../autenticacao'
import { ContextoBuscaSalva, ContextoOrigemSalva, buscaGlobal, useFiltros, type OrigemNavegacao } from '../filtros'
import { BarraFiltros } from './BarraFiltros'

const CHAVE_TEMA = 'sidebar-dark-mode'

const URL_GIO_OFICIAL =
  (typeof window !== 'undefined' &&
    (window as unknown as { __GIO_CONFIG__?: { gioUrl?: string } }).__GIO_CONFIG__?.gioUrl) ||
  import.meta.env.VITE_GIO_URL ||
  'https://gio.obras.rj.gov.br/'

// Ícones em linha (traço 1.75, 20px), sem biblioteca.
function Icone({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

const MENU = [
  {
    para: '/',
    rotulo: 'Visão geral',
    icone: (
      <Icone>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </Icone>
    ),
  },
  {
    para: '/municipios',
    rotulo: 'Municípios',
    icone: (
      <Icone>
        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </Icone>
    ),
  },
  {
    para: '/convenios',
    rotulo: 'Convênios',
    icone: (
      <Icone>
        <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </Icone>
    ),
  },
  {
    para: '/prestacao-de-contas',
    rotulo: 'Prestação de Contas',
    icone: (
      <Icone>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </Icone>
    ),
  },
  {
    para: '/tomada-de-contas',
    rotulo: 'Tomada de Contas',
    icone: (
      <Icone>
        <path d="M12 3v18" />
        <path d="M3 7l9-4 9 4" />
        <path d="M6 10l-3 6h6l-3-6z" />
        <path d="M18 10l-3 6h6l-3-6z" />
      </Icone>
    ),
  },
  {
    para: '/cargas',
    rotulo: 'Cargas',
    icone: (
      <Icone>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v5h-5" />
      </Icone>
    ),
  },
]

/** Aviso fixo no topo de todas as telas enquanto o sistema estiver em desenvolvimento. */
function FaixaDesenvolvimento() {
  return (
    <div
      role="note"
      className="relative z-40 flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-amber-950 bg-[repeating-linear-gradient(-45deg,transparent_0_12px,rgb(0_0_0/0.05)_12px_24px)]"
    >
      <Icone>
        <path d="M12 3 2 20h20L12 3Z" />
        <path d="M12 10v4M12 17h.01" />
      </Icone>
      <span>Em desenvolvimento (passível de bugs e/ou erros inesperados)</span>
    </div>
  )
}

/**
 * AlternadorEcossistema — Botão de acesso rápido ao painel oficial do GIO (Gestão de Obras).
 * Concebido como uma pílula translúcida única exatamente no padrão visual do GIO (EcosystemSwitcher).
 */
function AlternadorEcossistema() {
  return (
    <a
      href={URL_GIO_OFICIAL}
      target="_blank"
      rel="noopener noreferrer"
      title="Acessar o GIO — Gestão Integrada de Obras (https://gio.obras.rj.gov.br/)"
      aria-label="Ir para o GIO Gestão Integrada de Obras"
      className="group inline-flex shrink-0 items-center gap-2 h-[34px] rounded-full border border-gray-200/90 bg-white/80 pl-1 pr-3 py-0.5 text-gray-700 shadow-sm backdrop-blur-md select-none transition-all duration-200 ease-out hover:-translate-y-px hover:border-gray-300 hover:bg-white hover:text-gray-900 hover:shadow active:translate-y-0 cursor-pointer dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-xs transition-transform duration-200 ease-out group-hover:scale-105">
        <img src={oGio} alt="GIO" className="h-4 w-4 object-contain block" />
      </div>
      <span className="text-xs font-bold tracking-wider uppercase leading-none font-sans">
        GIO
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-3.5 shrink-0 text-gray-400 transition-all duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gray-700 dark:group-hover:text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 17L17 7M7 7h10v10" />
      </svg>
    </a>
  )
}

/** Telas que usam o bloco de filtros globais. */
const TELAS_COM_FILTROS = ['/municipios', '/convenios', '/prestacao-de-contas', '/tomada-de-contas']

const ID_MENU = 'menu-telas'

/** Moldura principal do painel no padrão visual GIO: sidebar clara/escura, fundo blueprint e área da tela ativa. */
export function Layout() {
  const { pathname } = useLocation()
  const { filtros, busca, limpar } = useFiltros()
  const { usuario, logout } = useAuth()
  const navegar = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [recolhida, setRecolhida] = useState(false)
  const [modoEscuro, setModoEscuro] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_TEMA) === 'true'
    } catch {
      return false
    }
  })
  const [buscaSalva, setBuscaSalva] = useState('')
  const [telaOrigemSalva, setTelaOrigemSalva] = useState<OrigemNavegacao>({
    rota: '/convenios',
    rotulo: 'Convênios',
  })
  const comFiltros = TELAS_COM_FILTROS.includes(pathname)
  const exibirBarraFiltros = comFiltros || pathname === '/convenio'
  const buscaAtual = buscaGlobal(busca)

  // Preserva os filtros globais tanto nas telas de listagem quanto ao selecionar um município direto pelo mapa.
  const selecionadoPeloMapaOuFiltro = pathname === '/convenio' && !busca.has('numero')
  if ((comFiltros || selecionadoPeloMapaOuFiltro) && buscaSalva !== buscaAtual) {
    setBuscaSalva(buscaAtual)
  }

  // Memoriza a última tela de listagem de origem (Convênios, Tomada de Contas, Prestação de Contas ou Municípios)
  if (comFiltros && pathname !== '/convenio' && telaOrigemSalva.rota !== pathname) {
    const rotulo =
      pathname === '/tomada-de-contas'
        ? 'Tomada de Contas'
        : pathname === '/prestacao-de-contas'
          ? 'Prestação de Contas'
          : pathname === '/municipios'
            ? 'Municípios'
            : 'Convênios'
    setTelaOrigemSalva({ rota: pathname, rotulo })
  }

  // No detalhe, preserva os filtros (incluindo município e recorte) que estavam ativos na aba de convênios;
  // se o detalhe foi aberto diretamente sem filtros prévios, leva apenas o mês.
  const buscaMenu =
    pathname === '/convenio'
      ? buscaSalva || buscaGlobal(new URLSearchParams([...busca].filter(([k]) => k === 'ano' || k === 'mes')))
      : buscaAtual

  /** Sincroniza a classe .dark no documento com o estado atual do tema. */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', modoEscuro)
  }, [modoEscuro])

  /** Alterna entre tema claro e escuro e persiste a escolha apenas sob ação explícita. */
  const alternarModoEscuro = () => {
    setModoEscuro((prev) => {
      const proximo = !prev
      try {
        localStorage.setItem(CHAVE_TEMA, String(proximo))
      } catch {
        // Ignora ambientes sem localStorage disponível
      }
      return proximo
    })
  }

  /** Encerra a sessão do usuário e redireciona para a tela de login. */
  const handleLogout = () => {
    navegar('/login')
    void logout()
  }

  // A gaveta (tela estreita) fecha ao escolher uma tela, com Esc e com clique no fundo.
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto])

  return (
    <>
      <FaixaDesenvolvimento />
      <div className="relative flex min-h-screen bg-gelo transition-colors duration-200 dark:bg-gray-950">
        {/* Fundo técnico blueprint padrão GIO */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center opacity-20 mix-blend-multiply transition-all duration-200 dark:opacity-10 dark:invert dark:mix-blend-screen"
          style={{ backgroundImage: 'url("/white_blueprint_sheets_bg.jpg")' }}
        />

        <AnimatePresence>
          {aberto && (
            <motion.div
              key="fundo"
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
              aria-hidden="true"
              onClick={() => setAberto(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </AnimatePresence>

        {/* Sidebar padrão GIO (clara/escura, colapsável e com destaque laranja) */}
        <aside
          id={ID_MENU}
          className={`fixed inset-y-0 left-0 z-50 flex-col border-r border-gray-200 bg-white text-gray-700 transition-all duration-200 lg:sticky lg:top-0 lg:z-20 lg:flex lg:h-screen dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 ${
            recolhida ? 'lg:w-16' : 'lg:w-64'
          } w-64 ${aberto ? 'flex animate-gaveta shadow-2xl lg:animate-none' : 'hidden'}`}
        >
          {/* Cabeçalho da sidebar com logotipo GIO */}
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-3 dark:border-gray-700">
            {recolhida ? (
              <button
                type="button"
                onClick={() => setRecolhida(false)}
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Expandir menu"
                aria-label="Expandir menu"
              >
                <img src={oGio} alt="GIO" className="block h-7 w-auto object-contain dark:hidden" />
                <img src={oGioBranca} alt="GIO" className="hidden h-7 w-auto object-contain dark:block" />
              </button>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-2.5 pl-1">
                  <img
                    src={logoGio}
                    alt="GIO - Gestão Integrada de Obras"
                    className="block h-9 w-auto object-contain dark:hidden"
                  />
                  <img
                    src={logoGioBranca}
                    alt="GIO - Gestão Integrada de Obras"
                    className="hidden h-9 w-auto object-contain dark:block"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRecolhida(true)}
                  className="hidden rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 lg:inline-flex dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  title="Recolher menu"
                  aria-label="Recolher menu"
                >
                  <Icone>
                    <path d="M15 18l-6-6 6-6" />
                  </Icone>
                </button>
              </>
            )}
          </div>

          {!recolhida && (
            <div className="px-4 pb-1 pt-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                GIO Convênios
              </p>
            </div>
          )}

          {/* Navegação principal */}
          <nav aria-label="Telas" className="flex-1 overflow-y-auto px-2.5 py-3">
            <ul className="space-y-1">
              {MENU.map((item) => (
                <li key={item.para}>
                  <NavLink
                    to={{ pathname: item.para, search: buscaMenu }}
                    end={item.para === '/'}
                    onClick={() => setAberto(false)}
                    title={recolhida ? item.rotulo : undefined}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-orange-500 ${
                        recolhida ? 'lg:justify-center lg:px-2' : ''
                      } ${
                        isActive
                          ? 'bg-orange-500/80 font-medium text-white shadow-sm'
                          : 'text-gray-600 hover:bg-orange-500/80 hover:text-white dark:text-gray-300 dark:hover:text-white'
                      }`
                    }
                  >
                    <span className="shrink-0 transition-transform duration-200 group-hover:scale-105">
                      {item.icone}
                    </span>
                    <span className={recolhida ? 'lg:hidden' : ''}>{item.rotulo}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Rodapé da sidebar: alternância de tema e usuário autenticado */}
          <div className="mt-auto border-t border-gray-200 p-3 dark:border-gray-700">
            <button
              type="button"
              onClick={alternarModoEscuro}
              className={`mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white ${
                recolhida ? 'lg:justify-center lg:px-2' : ''
              }`}
              title={modoEscuro ? 'Ativar tema claro' : 'Ativar tema escuro'}
              aria-label={modoEscuro ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {modoEscuro ? (
                <Icone>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </Icone>
              ) : (
                <Icone>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </Icone>
              )}
              <span className={recolhida ? 'lg:hidden' : ''}>
                {modoEscuro ? 'Tema claro' : 'Tema escuro'}
              </span>
            </button>

            {usuario && (
              <div
                className={`flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800/70 ${
                  recolhida ? 'lg:justify-center lg:p-1.5' : ''
                }`}
              >
                <div className={`min-w-0 flex-1 ${recolhida ? 'lg:hidden' : ''}`}>
                  <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                    {usuario.nome}
                  </p>
                  <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">
                    {usuario.email}
                  </p>
                  <span className="mt-1 inline-block rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                    {usuario.perfil}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  title="Sair do sistema"
                  aria-label="Sair do sistema"
                >
                  <Icone>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </Icone>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Área principal (header topbar + conteúdo + rodapé GIO) */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          {/* Barra superior (Topbar padrão GIO) */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200/80 bg-white/90 px-4 py-2.5 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-900/90 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 lg:hidden dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                aria-expanded={aberto}
                aria-controls={ID_MENU}
                onClick={() => setAberto((a) => !a)}
              >
                <Icone>
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </Icone>
                Menu
              </button>

              <div className="hidden lg:flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
                  GIO Convênios
                </span>
              </div>

              <span className="text-sm font-semibold text-gray-800 lg:hidden dark:text-gray-100">
                GIO Convênios
              </span>
            </div>

            <div className="flex items-center gap-3">
              <AlternadorEcossistema />

              {usuario && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100 lg:hidden dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  title="Encerrar sessão"
                >
                  Sair
                </button>
              )}
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            <ContextoBuscaSalva.Provider value={buscaSalva}>
              <ContextoOrigemSalva.Provider value={telaOrigemSalva}>
                <div className="mx-auto max-w-7xl space-y-6">
                  {exibirBarraFiltros && <BarraFiltros />}
                  {comFiltros && filtros.erro ? (
                    <div
                      role="alert"
                      className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-200"
                    >
                      <p className="font-medium">Filtro inválido na URL</p>
                      <p className="mt-1">{filtros.erro}</p>
                      <button type="button" className="botao-secundario mt-3" onClick={limpar}>
                        Limpar filtros
                      </button>
                    </div>
                  ) : (
                    // Cada troca de tela entra com um fade curto e uma leve subida.
                    <motion.div
                      key={pathname}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Outlet />
                    </motion.div>
                  )}
                </div>
              </ContextoOrigemSalva.Provider>
            </ContextoBuscaSalva.Provider>
          </main>

          {/* Rodapé institucional padrão GIO */}
          <footer className="border-t border-gray-200/80 bg-white/70 px-6 py-3 text-center text-xs text-gray-500 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-400">
            Copyright © 2026, Todos os direitos reservados · GIO Convênios
          </footer>
        </div>
      </div>
    </>
  )
}
