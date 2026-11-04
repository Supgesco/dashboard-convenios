// Peças compartilhadas pelas telas do painel.
import type { Contratual, Saldos } from '../api/tipos'
import { calcularVariacao, moeda, percentual, variacao } from '../formato'

export const CAMPOS_SALDO = [
  { campo: 'a_pagar', rotulo: 'A pagar' },
  { campo: 'a_comprovar', rotulo: 'A comprovar' },
  { campo: 'a_aprovar', rotulo: 'A aprovar' },
  { campo: 'aprovados', rotulo: 'Aprovados' },
] as const

export const CAMPOS_CONTRATUAL = [
  { campo: 'valor_total', rotulo: 'Valor total', pct: false },
  { campo: 'repasse_estado', rotulo: 'Repasse do Estado', pct: false },
  { campo: 'contrapartida', rotulo: 'Contrapartida', pct: false },
  { campo: 'investido_estado', rotulo: 'Investido pelo Estado', pct: false },
  { campo: 'a_repassar', rotulo: 'A repassar', pct: false },
  { campo: 'execucao_pct', rotulo: 'Execução', pct: true },
] as const

/** Endereço do detalhe; o mês só vai junto se foi escolhido na URL (senão o detalhe usa o mesmo padrão). */
export function linkDetalhe(numero: string, municipio: string, busca?: URLSearchParams): string {
  const p = new URLSearchParams({ numero, municipio })
  const ano = busca?.get('ano')
  const mes = busca?.get('mes')
  if (ano && mes) {
    p.set('ano', ano)
    p.set('mes', mes)
  }
  return `/convenio?${p.toString()}`
}

export function MarcaCompartilhado() {
  return (
    <span className="ml-1 text-amber-700" title="Código SIAFE compartilhado com outro convênio">
      <span aria-hidden="true">◆</span>
      <span className="sr-only"> (código compartilhado)</span>
    </span>
  )
}

export function LegendaCompartilhado() {
  return (
    <p className="mt-2 text-xs text-slate-500">
      <span aria-hidden="true" className="text-amber-700">
        ◆
      </span>{' '}
      Código compartilhado: um código SIAFE é usado por mais de um convênio. Os saldos desse código aparecem em cada
      linha, mas contam uma vez só no total.
    </p>
  )
}

interface CartoesSaldoProps {
  saldos: Saldos | null | undefined
  anterior: Saldos | null | undefined
}

/** Os 4 saldos SIAFE do mês, com a variação sobre o mês anterior ("—" se não der para calcular). */
export function CartoesSaldo({ saldos, anterior }: CartoesSaldoProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CAMPOS_SALDO.map(({ campo, rotulo }) => {
        const atual = saldos?.[campo]
        const v = calcularVariacao(atual, anterior?.[campo])
        return (
          <div key={campo} className="cartao" aria-label={rotulo}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{rotulo}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{moeda(atual)}</p>
            <p className="mt-1 text-xs text-slate-500">
              <span className="tabular-nums" data-testid={`variacao-${campo}`}>
                {variacao(v)}
              </span>{' '}
              vs. mês anterior
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function BlocoContratual({ titulo, valores }: { titulo: string; valores: Contratual }) {
  return (
    <section className="cartao" aria-label={titulo}>
      <h2 className="titulo-secao">{titulo}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
        {CAMPOS_CONTRATUAL.map(({ campo, rotulo, pct }) => (
          <div key={campo}>
            <dt className="text-xs text-slate-500">{rotulo}</dt>
            <dd className="font-medium tabular-nums">{pct ? percentual(valores[campo]) : moeda(valores[campo])}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
