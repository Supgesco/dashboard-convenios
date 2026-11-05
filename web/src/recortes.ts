// Nomes dos recortes nas telas. A URL e a API continuam usando '31', '89' e '342'.
import type { Recorte } from './api/tipos'
import { inteiro } from './formato'

export const NOME_RECORTE: Record<Recorte, string> = {
  '342': 'Histórico inicial',
  '89': 'Primeiro realinhamento',
  '31': 'Vigentes',
}

/** Do maior para o menor: cada recorte está contido no anterior (342 ⊃ 89 ⊃ 31). */
export const ORDEM_EXIBICAO: readonly Recorte[] = ['342', '89', '31']

/** "1 convênio", "31 convênios"; sem número (carregando ou falha), nada. */
export function textoConvenios(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null
  return `${inteiro(n)} ${n === 1 ? 'convênio' : 'convênios'}`
}

/** "Vigentes (31 convênios)", ou só "Vigentes" quando a quantidade não é conhecida. */
export function rotuloRecorte(r: Recorte, n?: number | null): string {
  const qtd = textoConvenios(n)
  return qtd ? `${NOME_RECORTE[r]} (${qtd})` : NOME_RECORTE[r]
}

/** Recortes de um convênio pelo nome, na ordem de exibição. */
export function nomesRecortes(recortes: readonly string[]): string {
  return ORDEM_EXIBICAO.filter((r) => recortes.includes(r))
    .map((r) => NOME_RECORTE[r])
    .join(', ')
}
