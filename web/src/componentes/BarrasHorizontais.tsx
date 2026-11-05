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
 * Gráfico de barras horizontais em HTML: rótulo, número escrito e barra proporcional ao maior valor.
 * A barra é só reforço visual (`aria-hidden`); a quantidade fica sempre em texto. Uma cor só: série única.
 */
export function BarrasHorizontais({ titulo, subtitulo, itens, vazio = 'Sem dados.' }: Props) {
  const maior = Math.max(0, ...itens.map((i) => i.valor))
  return (
    <section className="cartao" aria-label={titulo}>
      <h2 className="titulo-secao">{titulo}</h2>
      {subtitulo && <p className="subtitulo-secao">{subtitulo}</p>}
      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">{vazio}</p>
      ) : (
        <ul className="mt-5 space-y-3 text-sm">
          {itens.map((i) => (
            <li key={i.rotulo ?? ''}>
              <div className="flex justify-between gap-4">
                <span className="text-slate-700">{i.rotulo ?? 'Sem informação'}</span>
                <span className="font-semibold tabular-nums text-slate-900">{inteiro(i.valor)}</span>
              </div>
              <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  data-testid="barra"
                  className="h-full rounded-full bg-marca-500"
                  style={{ width: `${maior ? (i.valor / maior) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
