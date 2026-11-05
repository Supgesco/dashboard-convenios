// Peças compartilhadas pelas telas do painel.
import type { CSSProperties, ReactNode } from 'react'

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
  /** Cor de identidade (a da série no gráfico): faixa no topo e marca; o texto não usa a cor. */
  cor?: string
  /** Versão invertida (fundo marca escuro, texto claro): para o número principal da tela. */
  escuro?: boolean
  children?: ReactNode
}

/** Card de indicador: faixa de cor no topo, rótulo pequeno e valor grande (exato). */
export function CartaoDestaque({ rotulo, valor, cor, escuro, children }: CartaoDestaqueProps) {
  if (escuro) {
    return (
      <div
        className="flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-marca-700 to-marca-900 p-5 pt-6 text-white shadow-cartao-alto lg:row-span-2 lg:justify-center lg:p-7 2xl:row-span-1 2xl:p-5"
        aria-label={rotulo}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-marca-100">{rotulo}</p>
        <p className="text-3xl font-semibold tracking-tight tabular-nums lg:text-5xl 2xl:text-3xl">{valor}</p>
        {children && <div className="mt-auto pt-1 text-xs text-marca-100">{children}</div>}
      </div>
    )
  }
  return (
    <div
      className="cartao-kpi flex flex-col gap-2"
      aria-label={rotulo}
      style={cor ? ({ '--cor': cor } as CSSProperties) : undefined}
    >
      <p className="kpi-rotulo flex items-center gap-2">
        {cor && <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: cor }} />}
        {rotulo}
      </p>
      <p className="kpi-valor">{valor}</p>
      {children && <div className="mt-auto pt-1">{children}</div>}
    </div>
  )
}

/** Variação com sinal e seta: a direção não depende da cor (cinza neutro; subir não é bom nem ruim por si só). */
export function Variacao({ valor, campo }: { valor: number | null; campo: string }) {
  const seta = valor === null || valor === 0 ? null : valor > 0 ? '▲' : '▼'
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      <span className="selo bg-slate-100 font-semibold text-slate-700 tabular-nums">
        {seta && (
          <span aria-hidden="true" className="text-[0.6rem]" data-testid={`seta-${campo}`}>
            {seta}
          </span>
        )}
        <span data-testid={`variacao-${campo}`}>{variacao(valor)}</span>
      </span>
      vs. mês anterior
    </p>
  )
}

/** Barra horizontal de 0 a 100% (valor fora do intervalo é limitado; nulo não desenha barra). */
export function BarraProgresso({ pct, cor = 'bg-marca-600', rotulo }: { pct: number | null | undefined; cor?: string; rotulo: string }) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null
  const largura = Math.min(100, Math.max(0, pct))
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(largura)}
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
    >
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${largura}%` }} />
    </div>
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
      className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${antes ? 'lg:grid-cols-3 2xl:grid-cols-5' : 'xl:grid-cols-4'}`}
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
  const detalhes = CAMPOS_CONTRATUAL.filter((c) => c.campo !== 'valor_total' && c.campo !== 'execucao_pct')
  return (
    <section className="cartao @container" aria-label={titulo}>
      <h2 className="titulo-secao">{titulo}</h2>
      <div className="mt-5 grid gap-6 @2xl:grid-cols-2 @2xl:items-end">
        <div>
          <p className="kpi-rotulo">Valor total</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight break-words tabular-nums text-slate-900 xl:text-4xl">
            {moeda(valores.valor_total)}
          </p>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="kpi-rotulo">Execução</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-marca-700">
              {percentual(valores.execucao_pct)}
            </p>
          </div>
          <div className="mt-2">
            <BarraProgresso pct={valores.execucao_pct} rotulo={`Execução de ${titulo}`} />
          </div>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-3 @sm:grid-cols-2 @4xl:grid-cols-4">
        {detalhes.map(({ campo, rotulo }) => (
          <div key={campo} className="rounded-xl border border-slate-100 bg-gelo px-4 py-3.5">
            <dt className="text-xs font-medium text-slate-600">{rotulo}</dt>
            <dd className="mt-1 text-lg font-semibold tracking-tight whitespace-nowrap tabular-nums text-slate-900">
              {moeda(valores[campo])}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
