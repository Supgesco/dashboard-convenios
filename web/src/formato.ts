// Formatação pt-BR de todos os valores exibidos. Só null/undefined viram "—"; zero é zero.

export const AUSENTE = '—'
const FUSO = 'America/Sao_Paulo'

type Num = number | null | undefined

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtMoedaCurta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const fmtPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmtInteiro = new Intl.NumberFormat('pt-BR')
const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: FUSO })
const fmtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: FUSO })
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function ausente(v: unknown): v is null | undefined {
  return v === null || v === undefined
}

// Intl usa espaço não separável depois de "R$"; trocamos por espaço comum (leitura e testes).
const espaco = (s: string) => s.replace(/ /g, ' ')

export function moeda(v: Num): string {
  return ausente(v) ? AUSENTE : espaco(fmtMoeda.format(v))
}

/** Moeda abreviada para eixos de gráfico (R$ 1,2 mi). */
export function moedaCurta(v: Num): string {
  return ausente(v) ? AUSENTE : espaco(fmtMoedaCurta.format(v))
}

/** Percentual já em escala 0–100, com uma casa (45.5 → "45,5%"). */
export function percentual(v: Num): string {
  return ausente(v) ? AUSENTE : `${fmtPct.format(v)}%`
}

/** Variação em escala 0–100, com sinal (+3,2% / −1,0%). */
export function variacao(v: Num): string {
  if (ausente(v)) return AUSENTE
  const sinal = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sinal}${fmtPct.format(Math.abs(v))}%`
}

export function inteiro(v: Num): string {
  return ausente(v) ? AUSENTE : fmtInteiro.format(v)
}

/** Data e hora de um instante ISO, no fuso de São Paulo. */
export function dataHora(v: string | null | undefined): string {
  return ausente(v) ? AUSENTE : espaco(fmtDataHora.format(new Date(v)))
}

/** Data: "AAAA-MM-DD" é tratada como dia civil (sem fuso); instantes ISO vão para São Paulo. */
export function data(v: string | null | undefined): string {
  if (ausente(v)) return AUSENTE
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`
  return fmtData.format(new Date(v))
}

/** "nov/2026" */
export function mesAno(ano: number, mes: number): string {
  return `${MESES[mes - 1]}/${ano}`
}

/** Variação percentual (atual − anterior) / |anterior|; nula se faltar um dos dois ou o anterior for zero. */
export function calcularVariacao(atual: Num, anterior: Num): number | null {
  if (ausente(atual) || ausente(anterior) || anterior === 0) return null
  return ((atual - anterior) / Math.abs(anterior)) * 100
}
