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
}

/**
 * Ranking em barras horizontais (HTML): posição, rótulo, barra proporcional ao maior valor e número escrito.
 * A barra é só reforço visual (`aria-hidden`); a quantidade fica sempre em texto. Uma cor só: série única.
 * A posição vem de um contador CSS da lista ordenada (não entra no texto lido). Em card largo, cada item é uma
 * linha só; em card estreito (container query), a barra desce para baixo do rótulo.
 */
export function BarrasHorizontais({ titulo, subtitulo, itens, vazio = 'Sem dados.' }: Props) {
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
            return (
              <li
                key={i.rotulo ?? ''}
                className="group grid animate-surgir grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 transition-colors [counter-increment:posicao] before:text-right before:text-xs before:font-medium before:tabular-nums before:text-slate-400 before:content-[counter(posicao)] hover:bg-marca-50 @md:grid-cols-[1.5rem_minmax(0,11rem)_minmax(0,1fr)_2.5rem] @lg:grid-cols-[1.5rem_minmax(0,13rem)_minmax(0,1fr)_2.5rem]"
                style={{ animationDelay: `${k * 45}ms` }}
              >
                <span title={rotulo} className="truncate text-slate-700 transition-colors group-hover:text-slate-900">{rotulo}</span>
                <span className="text-right font-semibold tabular-nums text-slate-900 @md:order-last">
                  {inteiro(i.valor)}
                </span>
                <div
                  aria-hidden="true"
                  className="col-start-2 col-end-4 h-2.5 overflow-hidden rounded-full bg-slate-100 @md:col-start-auto @md:col-end-auto"
                >
                  <div
                    data-testid="barra"
                    className="h-full origin-left animate-crescer rounded-full bg-marca-500 transition-colors group-hover:bg-marca-600"
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
