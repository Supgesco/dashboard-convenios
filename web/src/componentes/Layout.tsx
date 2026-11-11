import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'

import { useAuth } from '../autenticacao'
import { ContextoBuscaSalva, buscaGlobal, useFiltros } from '../filtros'
import { BarraFiltros } from './BarraFiltros'

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

/** Telas que usam o bloco de filtros globais. */
const TELAS_COM_FILTROS = ['/municipios', '/convenios', '/prestacao-de-contas', '/tomada-de-contas']

const ID_MENU = 'menu-telas'

export function Layout() {
  const { pathname } = useLocation()
  const { filtros, busca, limpar } = useFiltros()
  const { usuario, logout } = useAuth()
  const navegar = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [buscaSalva, setBuscaSalva] = useState('')
  const comFiltros = TELAS_COM_FILTROS.includes(pathname)
  const exibirBarraFiltros = comFiltros || pathname === '/convenio'
  const buscaAtual = buscaGlobal(busca)

  if (comFiltros && buscaSalva !== buscaAtual) {
    setBuscaSalva(buscaAtual)
  }

  // No detalhe, preserva os filtros (incluindo município e recorte) que estavam ativos na aba de convênios;
  // se o detalhe foi aberto diretamente sem filtros prévios, leva apenas o mês.
  const buscaMenu =
    pathname === '/convenio'
      ? buscaSalva || buscaGlobal(new URLSearchParams([...busca].filter(([k]) => k === 'ano' || k === 'mes')))
      : buscaAtual

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
      <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
        {/* Barra superior só em tela estreita */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-marca-900 px-4 py-2.5 text-white shadow-md lg:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-expanded={aberto}
              aria-controls={ID_MENU}
              onClick={() => setAberto((a) => !a)}
            >
              <Icone>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </Icone>
              Menu
            </button>
            <span className="font-semibold text-sm">Painel de convênios</span>
          </div>
          {usuario && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-white/20 px-2.5 py-1 text-xs text-white/90 hover:bg-white/10"
              title="Encerrar sessão"
            >
              Sair
            </button>
          )}
        </header>

        <AnimatePresence>
          {aberto && (
            <motion.div
              key="fundo"
              className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] lg:hidden"
              aria-hidden="true"
              onClick={() => setAberto(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </AnimatePresence>

        <aside
          id={ID_MENU}
          className={`fixed inset-y-0 left-0 z-50 w-60 flex-col bg-gradient-to-b from-marca-900 to-marca-950 text-marca-100 lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-screen ${
            aberto ? 'flex animate-gaveta shadow-2xl lg:animate-none' : 'hidden'
          }`}
        >
          <div className="flex items-center gap-3 px-5 pb-6 pt-6">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-gradient-to-br from-slate-900 via-marca-900 to-cyan-950 p-1.5 text-white shadow-md ring-1 ring-white/10 transition-transform duration-300 hover:scale-105"
            >
              <svg viewBox="0 0 64 64" className="size-full" fill="none">
                <rect x="12" y="30" width="9" height="20" rx="2.5" fill="#38BDF8" opacity="0.85" />
                <rect x="27.5" y="20" width="9" height="30" rx="2.5" fill="#22D3EE" />
                <rect x="43" y="13" width="9" height="37" rx="2.5" fill="#34D399" />
                <path
                  d="M10 42C20 41 26 34 33 27C39 21 45 16 54 11"
                  stroke="#A7F3D0"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M45 10.5H54.5V20"
                  stroke="#34D399"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight tracking-tight text-white">Painel de convênios</p>
              <p className="text-xs text-marca-200">Fazenda RJ · SIAFE</p>
            </div>
          </div>
          <p
            className="px-6 pb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-marca-300"
            aria-hidden="true"
          >
            Navegação
          </p>
          <nav aria-label="Telas" className="flex-1 px-3">
            <ul className="space-y-1">
              {MENU.map((item) => (
                <li key={item.para}>
                  <NavLink
                    to={{ pathname: item.para, search: buscaMenu }}
                    end={item.para === '/'}
                    onClick={() => setAberto(false)}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                        isActive ? 'font-medium text-white' : 'text-marca-200 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Fundo e marca da tela ativa deslizam de um item para o outro. */}
                        {isActive && (
                          <motion.span
                            layoutId="menu-ativo"
                            aria-hidden="true"
                            className="absolute inset-0 rounded-lg bg-white/15 before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-marca-300"
                            transition={{
                              type: 'spring',
                              stiffness: 420,
                              damping: 34,
                            }}
                          />
                        )}
                        <span className="relative transition-transform duration-200 group-hover:scale-110">
                          {item.icone}
                        </span>
                        <span className="relative">{item.rotulo}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Usuário logado e ação de sair */}
          {usuario && (
            <div className="mt-auto border-t border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{usuario.nome}</p>
                  <p className="truncate text-[10px] text-marca-200">{usuario.email}</p>
                  <span className="mt-1 inline-block rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-cyan-300">
                    {usuario.perfil}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-white/10 p-2 text-marca-200 hover:bg-white/10 hover:text-white"
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
            </div>
          )}
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <ContextoBuscaSalva.Provider value={buscaSalva}>
            <div className="mx-auto max-w-7xl space-y-6">
              {exibirBarraFiltros && <BarraFiltros />}
              {comFiltros && filtros.erro ? (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
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
          </ContextoBuscaSalva.Provider>
        </main>
      </div>
    </>
  )
}
