import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'

import { buscaGlobal, useFiltros } from '../filtros'
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

/** Telas que usam o bloco de filtros globais. */
const TELAS_COM_FILTROS = ['/', '/municipios', '/convenios']

const ID_MENU = 'menu-telas'

export function Layout() {
  const { pathname } = useLocation()
  const { filtros, busca, limpar } = useFiltros()
  const [aberto, setAberto] = useState(false)
  const comFiltros = TELAS_COM_FILTROS.includes(pathname)
  // No detalhe, `municipio` é parte da chave do convênio, não filtro: o menu leva só o mês.
  const buscaMenu =
    pathname === '/convenio'
      ? buscaGlobal(new URLSearchParams([...busca].filter(([k]) => k === 'ano' || k === 'mes')))
      : buscaGlobal(busca)

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
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Barra superior só em tela estreita */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          type="button"
          className="botao-secundario inline-flex items-center gap-2"
          aria-expanded={aberto}
          aria-controls={ID_MENU}
          onClick={() => setAberto((a) => !a)}
        >
          <Icone>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </Icone>
          Menu
        </button>
        <span className="font-semibold text-marca-800">Painel de convênios</span>
      </header>

      {aberto && (
        <div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" aria-hidden="true" onClick={() => setAberto(false)} />
      )}

      <aside
        id={ID_MENU}
        className={`fixed inset-y-0 left-0 z-50 w-60 flex-col border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-screen ${
          aberto ? 'flex shadow-xl' : 'hidden'
        }`}
      >
        <div className="px-5 pb-4 pt-5">
          <p className="text-base font-semibold tracking-tight text-marca-800">Painel de convênios</p>
        </div>
        <nav aria-label="Telas" className="flex-1 px-3">
          <ul className="space-y-1">
            {MENU.map((item) => (
              <li key={item.para}>
                <NavLink
                  to={{ pathname: item.para, search: buscaMenu }}
                  end={item.para === '/'}
                  onClick={() => setAberto(false)}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-marca-600 ${
                      isActive
                        ? 'bg-marca-50 font-medium text-marca-800 before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-marca-600'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {item.icone}
                  {item.rotulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-5">
          {comFiltros && <BarraFiltros />}
          {comFiltros && filtros.erro ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-medium">Filtro inválido na URL</p>
              <p className="mt-1">{filtros.erro}</p>
              <button type="button" className="botao-secundario mt-3" onClick={limpar}>
                Limpar filtros
              </button>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>
    </div>
  )
}
