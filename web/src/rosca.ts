// Agrupamento e cores da rosca de participação (os maiores itens + "Outros").

export interface ItemRosca {
  /** `null` é o grupo sem informação. */
  rotulo: string | null
  valor: number
}

export interface FatiaRosca {
  chave: string
  rotulo: string
  valor: number
  /** Participação no total, 0–100 (nula se o total for zero). */
  pct: number | null
  cor: string
  outros: boolean
}

// Cores das fatias, em ordem fixa pela posição (a 1ª é a de mais convênios). As quatro primeiras
// são as da paleta das séries (`series.ts`); "Outros" é cinza neutro, de menor destaque.
// validate_palette.js --mode light --surface #ffffff, com o par fim→início (a rosca fecha o círculo):
//   lightness, chroma, CVD (pior ΔE 15,2 deutan) e visão normal (16,4) PASS; com "Outros" entre a 5ª e a 1ª,
//   pior ΔE 18,1 (protan) / 20,4 (normal) PASS. Contraste: WARN em #4fa8e0 (2,62:1) e #eda100 (2,17:1)
//   → a legenda escreve rótulo, quantidade e percentual de toda fatia; a cor nunca é a única identificação.
export const CORES_ROSCA = ['#1d5fc4', '#d9772b', '#4fa8e0', '#1c8f7a', '#eda100'] as const
export const COR_OUTROS = '#94a3b8'
export const ROTULO_OUTROS = 'Outros'
export const ROTULO_SEM_INFORMACAO = 'Sem informação'

/**
 * Os `n` itens de maior valor (desempate pelo rótulo) e, se sobrar algum, um "Outros" com a soma do resto.
 * O grupo nulo vira "Sem informação" e disputa o top como qualquer outro. Os rótulos em `semFatia`
 * nunca ganham fatia própria: entram direto em "Outros".
 */
export function agruparTop(itens: readonly ItemRosca[], n = 5, semFatia: readonly string[] = []): FatiaRosca[] {
  const ordenados = [...itens].sort(
    (a, b) => b.valor - a.valor || (a.rotulo ?? '￿').localeCompare(b.rotulo ?? '￿', 'pt-BR'),
  )
  const total = ordenados.reduce((s, i) => s + i.valor, 0)
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : null)
  const forcados = ordenados.filter((i) => i.rotulo !== null && semFatia.includes(i.rotulo))
  const candidatos = ordenados.filter((i) => !forcados.includes(i))
  const fatias: FatiaRosca[] = candidatos.slice(0, n).map((i, k) => ({
    chave: i.rotulo ?? '\u0000nulo',
    rotulo: i.rotulo ?? ROTULO_SEM_INFORMACAO,
    valor: i.valor,
    pct: pct(i.valor),
    cor: CORES_ROSCA[k % CORES_ROSCA.length],
    outros: false,
  }))
  const resto = [...candidatos.slice(n), ...forcados]
  if (resto.length > 0) {
    const soma = resto.reduce((s, i) => s + i.valor, 0)
    fatias.push({ chave: '\u0000outros', rotulo: ROTULO_OUTROS, valor: soma, pct: pct(soma), cor: COR_OUTROS, outros: true })
  }
  return fatias
}
