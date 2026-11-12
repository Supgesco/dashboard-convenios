// Lógica pura do mapa de municípios: junção por nome, faixas de quantidade, cores, dica e link.
// Nada aqui depende do Leaflet, para poder ser testado no jsdom.
import { buscaGlobal } from '../filtros'
import { inteiro } from '../formato'

/** Forma de comparação, igual à `dominios.chave()` da API: sem acentos, casefold, só letras e dígitos. */
export function chave(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

export interface Feicao {
  properties: { nome: string; codigo_ibge: string }
}

export interface Contagem {
  municipio: string
  convenios: number
}

/**
 * Quantidade de convênios por município do mapa, na chave do nome (0 quando a API não traz o município).
 * Linha da API sem município correspondente no mapa só gera aviso no console.
 */
export function juntar(feicoes: readonly Feicao[], linhas: readonly Contagem[]): Map<string, number> {
  const resultado = new Map(feicoes.map((f) => [chave(f.properties.nome), 0]))
  for (const l of linhas) {
    const k = chave(l.municipio)
    if (!resultado.has(k)) {
      console.warn(`Mapa de municípios: "${l.municipio}" não está na malha do RJ`)
      continue
    }
    resultado.set(k, (resultado.get(k) ?? 0) + l.convenios)
  }
  return resultado
}

/** Intervalo fechado de quantidades. */
export interface Faixa {
  de: number
  ate: number
}

/**
 * Até `max` faixas a partir das quantidades positivas (o zero é "Sem convênio", fora das faixas).
 * Com até `max` valores distintos, cada valor é uma faixa; acima disso, os cortes ficam nos quantis
 * (sempre valores presentes, então nenhuma faixa fica vazia) e as faixas são contíguas.
 */
export function faixas(quantidades: readonly number[], max = 5): Faixa[] {
  const positivas = quantidades.filter((q) => q > 0).sort((a, b) => a - b)
  const distintos = [...new Set(positivas)]
  if (distintos.length <= max) return distintos.map((v) => ({ de: v, ate: v }))

  const n = positivas.length
  const cortes = [
    ...new Set(Array.from({ length: max }, (_, k) => positivas[Math.ceil(((k + 1) / max) * n) - 1])),
  ]
  return cortes.map((ate, i) => ({ de: i === 0 ? positivas[0] : cortes[i - 1] + 1, ate }))
}

/** Formata o rótulo textual de uma faixa da legenda do mapa. */
export function rotuloFaixa(f: Faixa): string {
  return f.de === f.ate ? inteiro(f.de) : `${inteiro(f.de)} a ${inteiro(f.ate)}`
}

/**
 * Rampa de um matiz (marca-300 → marca-900), do claro ao escuro.
 * validate_palette.js --ordinal --mode light --surface #ffffff: monotone, ΔL >= 0.06,
 * ponta clara 2,32:1 no branco, matiz único (3°) → ALL CHECKS PASS.
 */
export const RAMPA = ['#86ace6', '#5389d8', '#2f6fcf', '#184ea3', '#142f5e'] as const
/** "Sem convênio": cinza neutro (slate-200), fora da rampa. */
export const COR_SEM = '#e2e8f0'

/** Com menos faixas que passos, usa os últimos: a faixa mais alta é sempre a mais escura. */
export function coresFaixas(f: readonly Faixa[]): string[] {
  return RAMPA.slice(RAMPA.length - f.length)
}

/** Retorna a cor correspondente à quantidade de convênios dentro das faixas calculadas. */
export function corDe(quantidade: number, f: readonly Faixa[]): string {
  if (quantidade <= 0) return COR_SEM
  const cores = coresFaixas(f)
  const i = f.findIndex((x) => quantidade >= x.de && quantidade <= x.ate)
  return i < 0 ? cores[cores.length - 1] : cores[i]
}

/** Monta o texto do tooltip exibido ao passar o mouse sobre um município no mapa. */
export function textoDica(nome: string, quantidade: number): string {
  return `${nome} · ${inteiro(quantidade)} ${quantidade === 1 ? 'convênio' : 'convênios'}`
}

/** Abre os detalhes dos convênios do município, mantendo recorte e mês. */
export function linkMunicipio(busca: URLSearchParams, municipio: string): string {
  return `/convenio${buscaGlobal(busca, { municipio })}`
}
