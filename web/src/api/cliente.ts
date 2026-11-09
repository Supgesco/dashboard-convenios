// Cliente HTTP fino: monta a URL, serializa parâmetros repetidos e transforma falhas em ApiErro.
import { atenderEstatico, emModoEstatico } from './modoEstatico'

export const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')

export type Valor = string | number | readonly string[] | null | undefined
export type Parametros = Record<string, Valor>

/**
 * Erro de uma chamada à API. `status` 0 = falha de rede (a API não respondeu).
 * `foraDaApi`: a resposta não é JSON, ou seja, veio de outro serviço (porta errada no proxy) ou do próprio proxy.
 */
export class ApiErro extends Error {
  readonly status: number
  readonly detail: unknown
  readonly foraDaApi: boolean

  constructor(status: number, detail: unknown, foraDaApi = false) {
    super(
      foraDaApi
        ? `A resposta não veio da API do painel (HTTP ${status}). Confira se a API está rodando e se o proxy aponta para ela (API_URL).`
        : mensagemDoDetail(status, detail),
    )
    this.name = 'ApiErro'
    this.status = status
    this.detail = detail
    this.foraDaApi = foraDaApi
  }
}

export function montarUrl(caminho: string, parametros: Parametros = {}): string {
  const busca = new URLSearchParams()
  for (const [nome, valor] of Object.entries(parametros)) {
    if (valor === null || valor === undefined || valor === '') continue
    if (Array.isArray(valor)) {
      for (const item of valor) busca.append(nome, item)
    } else {
      busca.append(nome, String(valor))
    }
  }
  const query = busca.toString()
  return `${API_BASE}${caminho}${query ? `?${query}` : ''}`
}

async function requisitar<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  caminho: string,
  parametros?: Parametros,
  body?: unknown,
): Promise<T> {
  if (emModoEstatico()) {
    return atenderEstatico<T>(metodo, caminho, parametros, body)
  }
  let resposta: Response
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    resposta = await fetch(montarUrl(caminho, parametros), {
      method: metodo,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new ApiErro(0, null)
  }
  const tipo = resposta.headers.get('Content-Type') ?? ''
  if (!tipo.includes('application/json')) throw new ApiErro(resposta.status, null, true)
  const corpo: unknown = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    const detail = corpo && typeof corpo === 'object' && 'detail' in corpo ? corpo.detail : corpo
    throw new ApiErro(resposta.status, detail)
  }
  return corpo as T
}

export function apiGet<T>(caminho: string, parametros?: Parametros): Promise<T> {
  return requisitar<T>('GET', caminho, parametros)
}

export function apiPost<T>(caminho: string, parametros?: Parametros): Promise<T> {
  return requisitar<T>('POST', caminho, parametros)
}

export function apiPostJson<T>(caminho: string, body: unknown): Promise<T> {
  return requisitar<T>('POST', caminho, undefined, body)
}

export function apiPut<T>(caminho: string, body: unknown): Promise<T> {
  return requisitar<T>('PUT', caminho, undefined, body)
}

export function apiDelete<T>(caminho: string, parametros?: Parametros): Promise<T> {
  return requisitar<T>('DELETE', caminho, parametros)
}

/** Texto legível para o `detail` da API (texto, objeto {msg, ...} ou a lista de validação do FastAPI). */
export function mensagemDoDetail(status: number, detail: unknown): string {
  if (status === 0) return 'Não foi possível falar com a API. Verifique se ela está rodando.'
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail)) {
    const partes = detail
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const { loc, msg } = item as { loc?: unknown; msg?: unknown }
        const campo = Array.isArray(loc) ? loc.filter((p) => p !== 'query').join('.') : ''
        return typeof msg === 'string' ? (campo ? `${campo}: ${msg}` : msg) : null
      })
      .filter((p): p is string => p !== null)
    if (partes.length) return partes.join('; ')
  }
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>
    if (typeof d.msg === 'string') {
      const extra = Array.isArray(d.municipios_invalidos)
        ? d.municipios_invalidos.join(', ')
        : typeof d.motivo === 'string'
          ? d.motivo
          : null
      return extra ? `${d.msg}: ${extra}` : d.msg
    }
  }
  return `A API respondeu com erro ${status}.`
}
