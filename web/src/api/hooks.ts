// Um hook TanStack Query por endpoint. A chave de cache é o endpoint mais os parâmetros normalizados.
import {
  QueryClient,
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { ApiErro, apiGet, apiPost } from './cliente'
import type {
  Convenios,
  DetalheConvenio,
  ExecucaoIniciada,
  ExecucaoStatus,
  Execucoes,
  Municipios,
  Recorte,
  Resumo,
  Serie,
} from './tipos'

/** Mês pedido à API; `null` deixa a API escolher (mês corrente). */
export type MesConsulta = { ano: number; mes: number } | null

export interface FiltroApi {
  recorte: Recorte
  municipios: readonly string[]
}

export interface PaginaApi {
  pagina: number
  ordem: string | null
}

export const TAMANHO_PAGINA = 20
export const INTERVALO_STATUS_MS = 5000

function erro4xx(erro: unknown): boolean {
  return erro instanceof ApiErro && erro.status >= 400 && erro.status < 500
}

export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (falhas, erro) => !erro4xx(erro) && falhas < 1,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      },
      mutations: { retry: false },
    },
  })
}

function paramsFiltro(f: FiltroApi, mes?: MesConsulta) {
  return { recorte: f.recorte, municipio: [...f.municipios], ano: mes?.ano, mes: mes?.mes }
}

function chaveFiltro(f: FiltroApi) {
  return { recorte: f.recorte, municipios: [...f.municipios].sort() }
}

interface Opcoes {
  /** Falso enquanto o mês de referência não foi resolvido. */
  enabled?: boolean
}

export function useResumo(filtro: FiltroApi, mes: MesConsulta, { enabled = true }: Opcoes = {}) {
  return useQuery({
    queryKey: ['resumo', chaveFiltro(filtro), mes],
    queryFn: () => apiGet<Resumo>('/painel/resumo', paramsFiltro(filtro, mes)),
    enabled,
  })
}

/** Resumo sem filtro, usado para o último mês disponível e a última importação da planilha. */
export function useResumoGeral() {
  return useQuery({
    queryKey: ['resumo-geral'],
    queryFn: () => apiGet<Resumo>('/painel/resumo', { recorte: '342' }),
    staleTime: 5 * 60_000,
  })
}

export function useSerie(filtro: FiltroApi) {
  return useQuery({
    queryKey: ['serie', chaveFiltro(filtro)],
    queryFn: () => apiGet<Serie>('/painel/serie', paramsFiltro(filtro)),
  })
}

export function useMunicipios(filtro: FiltroApi, mes: MesConsulta, pagina: PaginaApi, { enabled = true }: Opcoes = {}) {
  return useQuery({
    queryKey: ['municipios', chaveFiltro(filtro), mes, pagina],
    queryFn: () =>
      apiGet<Municipios>('/painel/municipios', {
        ...paramsFiltro(filtro, mes),
        pagina: pagina.pagina,
        tamanho: TAMANHO_PAGINA,
        ordem: pagina.ordem,
      }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Municípios com convênio no recorte, para o seletor (o RJ tem 92, cabe numa página de 100). */
export function useOpcoesMunicipios(recorte: Recorte) {
  return useQuery({
    queryKey: ['opcoes-municipios', recorte],
    queryFn: async () => {
      const r = await apiGet<Municipios>('/painel/municipios', { recorte, tamanho: 100, ordem: 'municipio' })
      if (r.total > r.itens.length) {
        console.warn(`Seletor de municípios: ${r.total} municípios, só ${r.itens.length} carregados`)
      }
      return r.itens.map((i) => i.municipio)
    },
    staleTime: 5 * 60_000,
  })
}

export function useConvenios(filtro: FiltroApi, mes: MesConsulta, pagina: PaginaApi, { enabled = true }: Opcoes = {}) {
  return useQuery({
    queryKey: ['convenios', chaveFiltro(filtro), mes, pagina],
    queryFn: () =>
      apiGet<Convenios>('/painel/convenios', {
        ...paramsFiltro(filtro, mes),
        pagina: pagina.pagina,
        tamanho: TAMANHO_PAGINA,
        ordem: pagina.ordem,
      }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useConvenio(numero: string, municipio: string, mes: MesConsulta, { enabled = true }: Opcoes = {}) {
  return useQuery({
    queryKey: ['convenio', numero, municipio, mes],
    queryFn: () => apiGet<DetalheConvenio>('/painel/convenio', { numero, municipio, ano: mes?.ano, mes: mes?.mes }),
    enabled,
  })
}

/** Última carga SIAFE; `null` quando nenhuma carga foi feita (a API responde 404). */
export function useStatusCarga() {
  const queryClient = useQueryClient()
  const consulta = useQuery({
    queryKey: ['status-carga'],
    queryFn: async () => {
      try {
        return await apiGet<ExecucaoStatus>('/etl/siafe/status')
      } catch (e) {
        if (e instanceof ApiErro && e.status === 404 && !e.foraDaApi) return null
        throw e
      }
    },
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.status === 'em_andamento' ? INTERVALO_STATUS_MS : false),
  })

  // Quando a carga sai de "em_andamento", o histórico e a posição do SIAFE mudam.
  const anterior = useRef<string | undefined>(undefined)
  const status = consulta.data?.status
  useEffect(() => {
    if (anterior.current === 'em_andamento' && status !== 'em_andamento') {
      void queryClient.invalidateQueries({ queryKey: ['execucoes'] })
      void queryClient.invalidateQueries({ queryKey: ['resumo'] })
      void queryClient.invalidateQueries({ queryKey: ['resumo-geral'] })
    }
    anterior.current = status
  }, [status, queryClient])

  return consulta
}

export function useExecucoes(pagina: number) {
  return useQuery({
    queryKey: ['execucoes', pagina],
    queryFn: () => apiGet<Execucoes>('/etl/siafe/execucoes', { pagina, tamanho: TAMANHO_PAGINA }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export type ResultadoDisparo =
  | { tipo: 'iniciada'; execucao_id: number }
  | { tipo: 'ja_em_andamento' }

/** Dispara a carga SIAFE. O 409 (carga já em andamento) não é erro: a tela passa a acompanhá-la. */
export function useDispararCarga() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<ResultadoDisparo> => {
      try {
        const r = await apiPost<ExecucaoIniciada>('/etl/siafe')
        return { tipo: 'iniciada', execucao_id: r.execucao_id }
      } catch (e) {
        if (e instanceof ApiErro && e.status === 409 && !e.foraDaApi) return { tipo: 'ja_em_andamento' }
        throw e
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['status-carga'] })
      await queryClient.invalidateQueries({ queryKey: ['execucoes'] })
    },
  })
}
