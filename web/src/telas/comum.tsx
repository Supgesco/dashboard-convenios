// Peças compartilhadas pelas telas do painel.
import type { ReactNode } from 'react'

import type { Contratual, Saldos } from '../api/tipos'
import { COR_SERIE } from '../series'
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
    <span className="ml-1 text-amber-600" title="Código SIAFE compartilhado com outro convênio">
      <span aria-hidden="true">◆</span>
      <span className="sr-only"> (código compartilhado)</span>
    </span>
  )
}

export function LegendaCompartilhado() {
  return (
    <p className="mt-2 text-xs text-slate-600">
      <span aria-hidden="true" className="text-amber-700">
        ◆
      </span>{' '}
      Código compartilhado: um código SIAFE é usado por mais de um convênio. Os saldos desse código aparecem em cada
      linha, mas contam uma vez só no total.
    </p>
  )
}

interface CartaoDestaqueProps {
  rotulo: string
  valor: string
  /** Cor de identidade (a da série no gráfico); só a marca usa a cor, o texto não. */
  cor?: string
  children?: ReactNode
}

/** Card de indicador: rótulo pequeno e valor grande. */
export function CartaoDestaque({ rotulo, valor, cor, children }: CartaoDestaqueProps) {
  return (
    <div className="cartao flex flex-col gap-1" aria-label={rotulo}>
      <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
        {cor && <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: cor }} />}
        {rotulo}
      </p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{valor}</p>
      {children}
    </div>
  )
}

/** Variação com sinal e seta: a direção não depende da cor (cinza neutro; subir não é bom nem ruim por si só). */
export function Variacao({ valor, campo }: { valor: number | null; campo: string }) {
  const seta = valor === null || valor === 0 ? null : valor > 0 ? '▲' : '▼'
  return (
    <p className="text-xs text-slate-500">
      <span className="inline-flex items-center gap-1 font-medium text-slate-700 tabular-nums">
        {seta && (
          <span aria-hidden="true" className="text-[0.65rem]" data-testid={`seta-${campo}`}>
            {seta}
          </span>
        )}
        <span data-testid={`variacao-${campo}`}>{variacao(valor)}</span>
      </span>{' '}
      vs. mês anterior
    </p>
  )
}

interface CartoesSaldoProps {
  saldos: Saldos | null | undefined
  anterior: Saldos | null | undefined
  /** Card que vem antes dos saldos na mesma grade (ex.: a quantidade de convênios). */
  antes?: ReactNode
}

/** Os 4 saldos SIAFE do mês, com a variação sobre o mês anterior ("—" se não der para calcular). */
export function CartoesSaldo({ saldos, anterior, antes }: CartoesSaldoProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${antes ? 'lg:grid-cols-3 2xl:grid-cols-5' : 'xl:grid-cols-4'}`}
    >
      {antes}
      {CAMPOS_SALDO.map(({ campo, rotulo }) => {
        const atual = saldos?.[campo]
        return (
          <CartaoDestaque key={campo} rotulo={rotulo} valor={moeda(atual)} cor={COR_SERIE[campo]}>
            <Variacao valor={calcularVariacao(atual, anterior?.[campo])} campo={campo} />
          </CartaoDestaque>
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
