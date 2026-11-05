import type { ReactNode } from 'react'

export interface Coluna<T> {
  /** Campo da API; se `ordenavel`, é o valor enviado em `ordem` (só campos da whitelist do endpoint). */
  campo: string
  rotulo: string
  valor: (item: T) => ReactNode
  ordenavel?: boolean
  numerica?: boolean
  /** Fica fixa à esquerda na rolagem horizontal. */
  fixa?: boolean
}

interface Props<T> {
  colunas: Coluna<T>[]
  itens: T[]
  chave: (item: T) => string
  total: number
  pagina: number
  tamanho: number
  ordem: string | null
  onOrdem: (ordem: string) => void
  onPagina: (pagina: number) => void
  onLinha?: (item: T) => void
  rotuloLinha?: (item: T) => string
  vazio?: string
  /** Nome do que a tabela lista, no total ("83 municípios"). */
  unidade: [singular: string, plural: string]
  atualizando?: boolean
}

/** Próxima ordem ao clicar no cabeçalho: crescente, depois decrescente. */
export function proximaOrdem(atual: string | null, campo: string): string {
  return atual === campo ? `-${campo}` : campo
}

export function TabelaPaginada<T>(p: Props<T>) {
  const paginas = Math.max(1, Math.ceil(p.total / p.tamanho))
  const [um, varios] = p.unidade
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-cartao ${
        p.atualizando ? 'opacity-60 transition-opacity' : ''
      }`}
    >
      {/* Rolagem própria nos dois eixos: é o que permite o cabeçalho fixo (sticky top-0) e a coluna fixa. */}
      <div className="max-h-[70vh] overflow-auto">
        <table className="tabela">
          <thead>
            <tr>
              {p.colunas.map((c) => {
                const direcao =
                  p.ordem === c.campo ? 'ascending' : p.ordem === `-${c.campo}` ? 'descending' : undefined
                return (
                  <th
                    key={c.campo}
                    scope="col"
                    aria-sort={direcao}
                    className={`tabela-th sticky top-0 ${c.numerica ? 'text-right' : ''} ${c.fixa ? 'left-0 z-20' : 'z-10'}`}
                  >
                    {c.ordenavel ? (
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 rounded uppercase tracking-wider hover:text-marca-800 focus-visible:outline-2 focus-visible:outline-marca-600 ${
                          c.numerica ? 'flex-row-reverse' : ''
                        } ${direcao ? 'text-marca-800' : ''}`}
                        onClick={() => p.onOrdem(proximaOrdem(p.ordem, c.campo))}
                      >
                        {c.rotulo}
                        <span aria-hidden="true" className="w-3">
                          {direcao === 'ascending' ? '▲' : direcao === 'descending' ? '▼' : ''}
                        </span>
                      </button>
                    ) : (
                      c.rotulo
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {p.itens.length === 0 ? (
              <tr>
                <td colSpan={p.colunas.length} className="px-4 py-10 text-center text-slate-500">
                  {p.vazio ?? 'Nenhum item encontrado.'}
                </td>
              </tr>
            ) : (
              p.itens.map((item) => (
                <tr
                  key={p.chave(item)}
                  className={`group transition-colors ${
                    p.onLinha
                      ? 'cursor-pointer hover:bg-marca-50 focus-visible:bg-marca-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca-600'
                      : ''
                  }`}
                  onClick={p.onLinha ? () => p.onLinha?.(item) : undefined}
                  onKeyDown={
                    p.onLinha
                      ? (e) => {
                          if (e.key === 'Enter') p.onLinha?.(item)
                        }
                      : undefined
                  }
                  tabIndex={p.onLinha ? 0 : undefined}
                  aria-label={p.rotuloLinha?.(item)}
                >
                  {p.colunas.map((c) => (
                    <td
                      key={c.campo}
                      className={`tabela-td whitespace-nowrap ${
                        c.numerica ? 'text-right tabular-nums' : ''
                      } ${
                        c.fixa
                          ? `sticky left-0 z-[1] bg-white font-medium text-slate-900 ${
                              p.onLinha ? 'group-hover:bg-marca-50 group-focus-visible:bg-marca-50' : ''
                            }`
                          : ''
                      }`}
                    >
                      {c.valor(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <nav
        aria-label="Paginação"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 bg-slate-50/60 px-4 py-3 text-sm text-slate-600"
      >
        <span className="font-medium tabular-nums text-slate-700">
          {p.total} {p.total === 1 ? um : varios}
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            className="botao-secundario"
            disabled={p.pagina <= 1}
            onClick={() => p.onPagina(p.pagina - 1)}
          >
            Anterior
          </button>
          <span className="tabular-nums">
            Página {p.pagina} de {paginas}
          </span>
          <button
            type="button"
            className="botao-secundario"
            disabled={p.pagina >= paginas}
            onClick={() => p.onPagina(p.pagina + 1)}
          >
            Próxima
          </button>
        </span>
      </nav>
    </div>
  )
}
