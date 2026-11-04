import { NavLink, Outlet, useLocation } from 'react-router'

import { buscaGlobal, useFiltros } from '../filtros'
import { BarraFiltros } from './BarraFiltros'

const MENU = [
  { para: '/', rotulo: 'Visão geral' },
  { para: '/municipios', rotulo: 'Municípios' },
  { para: '/convenios', rotulo: 'Convênios' },
  { para: '/cargas', rotulo: 'Cargas' },
]

/** Telas que usam a barra de filtros globais. */
const TELAS_COM_FILTROS = ['/', '/municipios', '/convenios']

export function Layout() {
  const { pathname } = useLocation()
  const { filtros, busca, limpar } = useFiltros()
  const comFiltros = TELAS_COM_FILTROS.includes(pathname)
  // No detalhe, `municipio` é parte da chave do convênio, não filtro: o menu leva só o mês.
  const buscaMenu =
    pathname === '/convenio'
      ? buscaGlobal(new URLSearchParams([...busca].filter(([k]) => k === 'ano' || k === 'mes')))
      : buscaGlobal(busca)

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="flex flex-wrap items-center gap-6 px-6 py-3">
          <span className="font-semibold">Painel de convênios</span>
          <nav aria-label="Telas">
            <ul className="flex gap-1">
              {MENU.map((item) => (
                <li key={item.para}>
                  <NavLink
                    to={{ pathname: item.para, search: buscaMenu }}
                    end={item.para === '/'}
                    className={({ isActive }) =>
                      `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-white/15 font-medium' : 'text-slate-300 hover:text-white'}`
                    }
                  >
                    {item.rotulo}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      {comFiltros && <BarraFiltros />}
      <main className="mx-auto max-w-7xl px-6 py-6">
        {comFiltros && filtros.erro ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-medium">Filtro inválido na URL</p>
            <p className="mt-1">{filtros.erro}</p>
            <button type="button" className="botao-secundario mt-3" onClick={limpar}>
              Limpar filtros
            </button>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
