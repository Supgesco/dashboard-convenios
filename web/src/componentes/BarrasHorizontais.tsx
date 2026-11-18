import { inteiro } from '../formato'

export interface ItemBarra {
  /** `null` é o grupo sem informação. */
  rotulo: string | null
  valor: number
}

interface Props {
  titulo: string
  subtitulo?: string
  itens: readonly ItemBarra[]
  vazio?: string
  onItem?: (item: ItemBarra) => void
}

/**
 * Ranking em barras horizontais (HTML): posição, rótulo, barra proporcional ao maior valor e número escrito.
 * A barra é só reforço visual (`aria-hidden`); a quantidade fica sempre em texto. Uma cor só: série única.
 * A posição vem de um contador CSS da lista ordenada (não entra no texto lido). Em card largo, cada item é uma
 * linha só; em card estreito (container query), a barra desce para baixo do rótulo.
 */
export function BarrasHorizontais({ titulo, subtitulo, itens, vazio = 'Sem dados.', onItem }: Props) {
  const maior = Math.max(0, ...itens.map((i) => i.valor))
  return (
    <section className="cartao @container flex flex-col" aria-label={titulo}>
      <h2 className="titulo-secao">{titulo}</h2>
      {subtitulo && <p className="subtitulo-secao">{subtitulo}</p>}
      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">{vazio}</p>
      ) : (
        <ol className="mt-4 flex flex-1 flex-col justify-center text-[13px] [counter-reset:posicao]">
          {itens.map((i, k) => {
            const rotulo = i.rotulo ?? 'Sem informação'
            const largura = maior ? (i.valor / maior) * 100 : 0
            const clicavel = Boolean(onItem && i.rotulo)
            return (
              <li
                key={i.rotulo ?? ''}
                className={`group grid animate-surgir grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 transition-colors [counter-increment:posicao] before:text-right before:text-xs before:font-medium before:tabular-nums before:text-slate-400 before:content-[counter(posicao)] @md:grid-cols-[1.5rem_minmax(0,11rem)_minmax(0,1fr)_2.5rem] @lg:grid-cols-[1.5rem_minmax(0,13rem)_minmax(0,1fr)_2.5rem] ${
                  clicavel
                    ? 'cursor-pointer hover:bg-marca-50 dark:hover:bg-[#103752] focus-visible:bg-marca-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-600 dark:focus-visible:bg-[#103752] dark:focus-visible:outline-sky-400'
                    : 'hover:bg-marca-50 dark:hover:bg-slate-800/40'
                }`}
                style={{ animationDelay: `${k * 45}ms` }}
                onClick={clicavel ? () => onItem?.(i) : undefined}
                onKeyDown={
                  clicavel
                    ? (e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          onItem?.(i)
                        }
                      }
                    : undefined
                }
                tabIndex={clicavel ? 0 : undefined}
              >
                <span
                  title={clicavel ? `Ver detalhes de ${rotulo}` : rotulo}
                  className="truncate text-slate-700 transition-colors group-hover:text-marca-700 dark:text-slate-300 dark:group-hover:text-sky-300"
                >
                  {rotulo}
                </span>
                <span className="text-right font-semibold tabular-nums text-slate-900 @md:order-last dark:text-white">
                  {inteiro(i.valor)}
                </span>
                <div
                  aria-hidden="true"
                  className="col-start-2 col-end-4 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800 @md:col-start-auto @md:col-end-auto"
                >
                  <div
                    data-testid="barra"
                    className="h-full origin-left animate-crescer rounded-full bg-marca-500 transition-colors group-hover:bg-marca-600 dark:bg-sky-500 dark:group-hover:bg-sky-400"
                    style={{ width: `${largura}%`, animationDelay: `${80 + k * 45}ms` }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
