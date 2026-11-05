// Peças compartilhadas pelas telas do painel.
import { motion } from 'motion/react'
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
export function Variacao({ valor, campo, mes }: { valor: number | null; campo: string; mes?: string }) {
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
      vs. {mes ?? 'mês anterior'}
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
  /** Nome do mês anterior ("out/2026"): com ele, cada card mostra também o valor daquele mês. */
  mesAnterior?: string
}

/** Os 4 saldos SIAFE do mês, com a variação sobre o mês anterior ("—" se não der para calcular). */
export function CartoesSaldo({ saldos, anterior, antes, mesAnterior }: CartoesSaldoProps) {
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
            <div className="space-y-2">
              <Variacao valor={calcularVariacao(atual, anterior?.[campo])} campo={campo} mes={mesAnterior} />
              {mesAnterior && (
                <p className="text-xs text-slate-500">
                  Em {mesAnterior}:{' '}
                  <span className="font-medium tabular-nums text-slate-700">
                    {anterior ? moeda(anterior[campo]) : 'sem dados'}
                  </span>
                </p>
              )}
            </div>
          </CartaoDestaque>
        )
      })}
    </div>
  )
}

/** Anel de 0 a 100% (o texto no centro mostra o valor real, mesmo acima de 100%). */
function AnelExecucao({ pct, rotulo, cor }: { pct: number | null; rotulo: string; cor: string }) {
  const valido = pct !== null && Number.isFinite(pct)
  const fracao = valido ? Math.min(100, Math.max(0, pct)) / 100 : 0
  return (
    <div
      className="relative grid size-32 shrink-0 place-items-center"
      {...(valido
        ? {
            role: 'progressbar',
            'aria-label': rotulo,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round(fracao * 100),
          }
        : {})}
    >
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r="50" fill="none" strokeWidth="11" className="stroke-slate-100" />
        {valido && fracao > 0 && (
          <motion.circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            strokeWidth="11"
            strokeLinecap="round"
            className={cor}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: fracao }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
        )}
      </svg>
      <div className="relative text-center">
        <p className="text-xl font-semibold tracking-tight tabular-nums text-slate-900">{percentual(pct)}</p>
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Execução</p>
      </div>
    </div>
  )
}

const ICONE_CONTRATUAL: Record<string, ReactNode> = {
  repasse_estado: <path d="M3 10h18M5 10V20M19 10V20M9 10v10M15 10v10M3 20h18M12 3l9 5H3l9-5Z" />,
  contrapartida: <path d="M7 12h10M12 7v10M4 4h16v16H4z" />,
  investido_estado: <path d="M4 17l6-6 4 4 6-7M14 8h6v6" />,
  a_repassar: <path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
}

interface BlocoContratualProps {
  /** Nome acessível da seção (ex.: "Valores contratuais · Vigentes"). */
  titulo: string
  /** Nome do recorte, mostrado no topo do card. */
  recorte: string
  /** Destaque verde (o recorte dos vigentes). */
  destaque?: boolean
  valores: Contratual
}

export function BlocoContratual({ titulo, recorte, destaque, valores }: BlocoContratualProps) {
  const detalhes = CAMPOS_CONTRATUAL.filter((c) => c.campo !== 'valor_total' && c.campo !== 'execucao_pct')
  return (
    <section
      className="cartao-kpi @container flex flex-col gap-5 p-6 pt-7"
      aria-label={titulo}
      style={{ '--cor': destaque ? 'var(--color-emerald-600)' : 'var(--color-marca-600)' } as CSSProperties}
    >
      <h3 className="titulo-secao flex items-center gap-2">
        <span aria-hidden="true" className={`size-2 rounded-full ${destaque ? 'bg-emerald-600' : 'bg-marca-600'}`} />
        <span className="sr-only">Valores contratuais · </span>
        {recorte}
      </h3>
      <div className="flex flex-col gap-5 @sm:flex-row @sm:items-center @sm:justify-between">
        <div className="min-w-0">
          <p className="kpi-rotulo">Valor total</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight break-words tabular-nums text-slate-900 @lg:text-4xl">
            <NumeroAnimado valor={valores.valor_total} formatar={moeda} />
          </p>
        </div>
        <AnelExecucao
          pct={valores.execucao_pct}
          rotulo={`Execução de ${titulo}`}
          cor={destaque ? 'stroke-emerald-600' : 'stroke-marca-600'}
        />
      </div>
      <dl className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @5xl:grid-cols-4">
        {detalhes.map(({ campo, rotulo }) => (
          <div
            key={campo}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-gelo px-4 py-3.5 transition-colors hover:border-slate-200 hover:bg-white"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200/70">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONE_CONTRATUAL[campo]}
              </svg>
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-600">{rotulo}</dt>
              <dd className="mt-0.5 text-base font-semibold tracking-tight whitespace-nowrap tabular-nums text-slate-900">
                {moeda(valores[campo])}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}
