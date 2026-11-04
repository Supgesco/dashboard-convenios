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
    <div className={p.atualizando ? 'opacity-60 transition-opacity' : undefined}>
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {p.colunas.map((c) => {
                const direcao =
                  p.ordem === c.campo ? 'ascending' : p.ordem === `-${c.campo}` ? 'descending' : undefined
                return (
                  <th
                    key={c.campo}
                    scope="col"
                    aria-sort={direcao}
                    className={`whitespace-nowrap px-3 py-2 font-medium ${c.numerica ? 'text-right' : ''} ${
                      c.fixa ? 'sticky left-0 z-10 bg-slate-50' : ''
                    }`}
                  >
                    {c.ordenavel ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase hover:text-slate-900"
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
          <tbody className="divide-y divide-slate-100">
            {p.itens.length === 0 ? (
              <tr>
                <td colSpan={p.colunas.length} className="px-3 py-6 text-center text-slate-500">
                  {p.vazio ?? 'Nenhum item encontrado.'}
                </td>
              </tr>
            ) : (
              p.itens.map((item) => (
                <tr
                  key={p.chave(item)}
                  className={p.onLinha ? 'cursor-pointer hover:bg-sky-50 focus:bg-sky-50 focus:outline-none' : undefined}
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
                      className={`whitespace-nowrap px-3 py-2 ${c.numerica ? 'text-right tabular-nums' : ''} ${
                        c.fixa ? 'sticky left-0 bg-white' : ''
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
      <nav aria-label="Paginação" className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>
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
          <span>
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
