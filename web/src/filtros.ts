// Estado dos filtros: vive só na URL. Este módulo lê e escreve os parâmetros; nada é copiado para estado local.
import { createContext, useCallback, useContext, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { useResumoGeral, type FiltroApi, type MesConsulta } from './api/hooks'
import { RECORTES, type Recorte } from './api/tipos'

export const ContextoBuscaSalva = createContext<string>('')

export function useBuscaSalva(): string {
  return useContext(ContextoBuscaSalva)
}

export const RECORTE_PADRAO: Recorte = '31'

export interface Filtros extends FiltroApi {
  /** Mês escolhido na URL; `null` = usar o último mês disponível. */
  mes: MesConsulta
  pagina: number
  ordem: string | null
  /** Mensagem quando a URL traz um filtro inválido (as telas não consultam a API nesse caso). */
  erro: string | null
}

function inteiro(texto: string | null): number | null {
  if (texto === null || !/^\d+$/.test(texto)) return null
  return Number(texto)
}

export function lerFiltros(busca: URLSearchParams): Filtros {
  const erros: string[] = []

  const recorteTexto = busca.get('recorte')
  let recorte = RECORTE_PADRAO
  if (recorteTexto !== null) {
    if ((RECORTES as readonly string[]).includes(recorteTexto)) recorte = recorteTexto as Recorte
    else erros.push(`recorte "${recorteTexto}" não existe (use 31, 89 ou 342)`)
  }

  const municipios = busca.getAll('municipio').filter((m) => m.trim() !== '')

  let mes: MesConsulta = null
  const anoTexto = busca.get('ano')
  const mesTexto = busca.get('mes')
  if (anoTexto !== null || mesTexto !== null) {
    const a = inteiro(anoTexto)
    const m = inteiro(mesTexto)
    if (a !== null && m !== null && a >= 2000 && a <= 2100 && m >= 1 && m <= 12) mes = { ano: a, mes: m }
    else erros.push('mês de referência inválido (informe ano e mes juntos)')
  }

  const pagina = Math.max(1, inteiro(busca.get('pagina')) ?? 1)
  const ordem = busca.get('ordem') || null

  return { recorte, municipios, mes, pagina, ordem, erro: erros.length ? erros.join('; ') : null }
}

export interface Mudanca {
  recorte?: Recorte
  municipios?: readonly string[]
  mes?: MesConsulta
  pagina?: number
  ordem?: string | null
}

/** Aplica a mudança aos parâmetros. Trocar recorte, municípios, mês ou ordem volta para a página 1. */
export function aplicarMudanca(busca: URLSearchParams, mudanca: Mudanca): URLSearchParams {
  const nova = new URLSearchParams(busca)
  let resetarPagina = false

  if (mudanca.recorte !== undefined) {
    if (mudanca.recorte === RECORTE_PADRAO) nova.delete('recorte')
    else nova.set('recorte', mudanca.recorte)
    resetarPagina = true
  }
  if (mudanca.municipios !== undefined) {
    nova.delete('municipio')
    for (const m of mudanca.municipios) nova.append('municipio', m)
    resetarPagina = true
  }
  if (mudanca.mes !== undefined) {
    nova.delete('ano')
    nova.delete('mes')
    if (mudanca.mes) {
      nova.set('ano', String(mudanca.mes.ano))
      nova.set('mes', String(mudanca.mes.mes))
    }
    resetarPagina = true
  }
  if (mudanca.ordem !== undefined) {
    if (mudanca.ordem) nova.set('ordem', mudanca.ordem)
    else nova.delete('ordem')
    resetarPagina = true
  }
  if (mudanca.pagina !== undefined && !resetarPagina) {
    if (mudanca.pagina > 1) nova.set('pagina', String(mudanca.pagina))
    else nova.delete('pagina')
  } else if (resetarPagina) {
    nova.delete('pagina')
  }
  return nova
}

/** Só os filtros globais (recorte, municípios, mês), para links entre telas. Página e ordem são de cada tela. */
export function buscaGlobal(busca: URLSearchParams, extra: Record<string, string | readonly string[]> = {}): string {
  const nova = new URLSearchParams()
  for (const nome of ['recorte', 'municipio', 'ano', 'mes']) {
    for (const valor of busca.getAll(nome)) nova.append(nome, valor)
  }
  for (const [nome, valor] of Object.entries(extra)) {
    nova.delete(nome)
    for (const v of typeof valor === 'string' ? [valor] : valor) nova.append(nome, v)
  }
  const texto = nova.toString()
  return texto ? `?${texto}` : ''
}

export function useFiltros() {
  const [busca, setBusca] = useSearchParams()
  const filtros = useMemo(() => lerFiltros(busca), [busca])

  const mudar = useCallback(
    (mudanca: Mudanca) => setBusca((atual) => aplicarMudanca(atual, mudanca)),
    [setBusca],
  )
  const limpar = useCallback(() => setBusca(new URLSearchParams()), [setBusca])

  return { filtros, busca, mudar, limpar }
}

export interface MesReferencia {
  /** Mês para as consultas (`null` = deixar a API escolher o mês corrente). */
  mes: MesConsulta
  /** Falso enquanto o último mês disponível ainda está sendo consultado. */
  resolvido: boolean
  /** Último mês com dados do SIAFE, quando a API informou. */
  ultimoDisponivel: MesConsulta
  /** O mês veio da URL (escolha do usuário) ou é o padrão. */
  daUrl: boolean
}

/** Mês da URL, ou o último mês com dados do SIAFE. Não escreve o padrão na URL. */
export function useMesReferencia(mesDaUrl: MesConsulta): MesReferencia {
  const geral = useResumoGeral()
  const ultimo = geral.data?.referencia.ultimo_mes_disponivel ?? null
  const ultimoDisponivel = ultimo ? { ano: ultimo.ano, mes: ultimo.mes } : null

  if (mesDaUrl) return { mes: mesDaUrl, resolvido: true, ultimoDisponivel, daUrl: true }
  // Se o resumo falhar, as telas seguem com o padrão da API em vez de ficar travadas.
  const resolvido = geral.isSuccess || geral.isError
  return { mes: ultimoDisponivel, resolvido, ultimoDisponivel, daUrl: false }
}
