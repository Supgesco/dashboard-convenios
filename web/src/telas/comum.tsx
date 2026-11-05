// Peças compartilhadas pelas telas do painel.
import type { CSSProperties, ReactNode } from 'react'

import type { Contratual, Saldos } from '../api/tipos'
import { NumeroAnimado } from '../componentes/NumeroAnimado'
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
  /** Texto pronto ou nó (ex.: `NumeroAnimado`). */
  valor: ReactNode
  /** Cor de identidade (a da série no gráfico): faixa no topo e marca; o texto não usa a cor. */
  cor?: string
  /** Versão invertida (fundo marca escuro, texto claro): para o número principal da tela. */
  escuro?: boolean
  /** Tom da versão invertida: azul da marca (padrão) ou verde (destaque dos vigentes). */
  tom?: 'marca' | 'verde'
  /** Valor maior (quantidades em destaque, na linha de cima). */
  grande?: boolean
  /** Classes extras do card (ex.: quantas colunas ele ocupa na grade). */
  className?: string
  children?: ReactNode
}

// Contraste do texto pequeno: marca-100 sobre marca-700 e emerald-100 sobre emerald-700 passam de 4,5:1;
// o gradiente só escurece a partir daí.
const TONS_ESCUROS = {
  marca: {
    fundo: 'from-marca-700 to-marca-900 hover:shadow-[0_16px_36px_-10px_rgb(20_47_94/0.55)]',
    brilho: 'bg-marca-400/25',
    suave: 'text-marca-100',
  },
  verde: {
    fundo: 'from-emerald-700 to-emerald-900 hover:shadow-[0_16px_36px_-10px_rgb(6_78_59/0.55)]',
    brilho: 'bg-emerald-300/25',
    suave: 'text-emerald-100',
  },
} as const

/**
 * Card de indicador: rótulo pequeno, valor grande (exato) e rodapé encostado embaixo, para que cards
 * lado a lado alinhem o rodapé mesmo com conteúdos de alturas diferentes.
 */
export function CartaoDestaque({
  rotulo,
  valor,
  cor,
  escuro,
  tom = 'marca',
  grande,
  className = '',
  children,
}: CartaoDestaqueProps) {
  if (escuro) {
    const t = TONS_ESCUROS[tom]
    return (
      <div
        className={`relative flex flex-col gap-2 overflow-hidden rounded-2xl bg-gradient-to-br ${t.fundo} p-5 pt-6 text-white shadow-cartao-alto transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 ${className}`}
        aria-label={rotulo}
      >
        {/* Brilho decorativo no canto */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -top-12 -right-12 size-40 rounded-full ${t.brilho} blur-2xl`}
        />
        <p className={`text-xs font-semibold uppercase tracking-wider ${t.suave}`}>{rotulo}</p>
        <p className={`kpi-valor text-white ${grande ? 'kpi-valor-grande' : ''}`}>{valor}</p>
        {children && <div className={`mt-auto pt-1 text-xs ${t.suave}`}>{children}</div>}
      </div>
    )
  }
  return (
    <div
      className={`cartao-kpi flex flex-col gap-2 ${className}`}
      aria-label={rotulo}
      style={cor ? ({ '--cor': cor } as CSSProperties) : undefined}
    >
      <p className="kpi-rotulo flex items-center gap-2">
        {cor && <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: cor }} />}
        {rotulo}
      </p>
      <p className={`kpi-valor ${grande ? 'kpi-valor-grande' : ''}`}>{valor}</p>
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
export function BarraProgresso({
  pct,
  cor = 'bg-marca-600',
  trilho = 'bg-slate-100',
  rotulo,
}: {
  pct: number | null | undefined
  cor?: string
  trilho?: string
  rotulo: string
}) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null
  const largura = Math.min(100, Math.max(0, pct))
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(largura)}
      className={`h-2 w-full overflow-hidden rounded-full ${trilho}`}
    >
      <div
        className={`h-full origin-left animate-crescer rounded-full ${cor}`}
        style={{ width: `${largura}%` }}
      />
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
      className={`grade-surgir grid grid-cols-1 gap-5 sm:grid-cols-2 ${antes ? 'lg:grid-cols-3 2xl:grid-cols-5' : 'xl:grid-cols-4'}`}
    >
      {antes}
      {CAMPOS_SALDO.map(({ campo, rotulo }) => {
        const atual = saldos?.[campo]
        return (
          <CartaoDestaque
            key={campo}
            rotulo={rotulo}
            valor={<NumeroAnimado valor={atual} formatar={moeda} />}
            cor={COR_SERIE[campo]}
          >
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
