// Um hook TanStack Query por endpoint. A chave de cache é o endpoint mais os parâmetros normalizados.
import {
  QueryClient,
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { ApiErro, apiDelete, apiGet, apiPost, apiPostJson, apiPut } from './cliente'
import { RECORTES } from './tipos'
import type {
  Convenios,
  DetalheConvenio,
  ExecucaoIniciada,
  ExecucaoStatus,
  Execucoes,
  LinhaConvenio,
  LinhaMunicipio,
  LinhaPrestacaoContas,
  LinhaTomadaContas,
  Municipios,
  PrestacaoContasResposta,
  Recorte,
  Resumo,
  TomadaContasResposta,
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

/** Resumo de um recorte inteiro, sem município e sem mês. A contagem de convênios não depende do mês. */
function consultaResumoSemFiltro(recorte: Recorte) {
  return {
    queryKey: ['resumo-geral', recorte],
    queryFn: () => apiGet<Resumo>('/painel/resumo', { recorte }),
    staleTime: 5 * 60_000,
  }
}

/** Resumo de um recorte inteiro (sem município e sem mês), com o mesmo cache da contagem dos recortes. */
export function useResumoRecorte(recorte: Recorte) {
  return useQuery(consultaResumoSemFiltro(recorte))
}

/**
 * Ranking de municípios de um recorte inteiro, sem município e sem mês: para a Visão geral, que só usa
 * a quantidade de convênios por município e o `total` (quantos municípios têm convênio).
 */
export function useRankingRecorte(recorte: Recorte, tamanho: number, ordem: string | null = null) {
  return useQuery({
    queryKey: ['ranking-recorte', recorte, tamanho, ordem],
    queryFn: () => apiGet<Municipios>('/painel/municipios', { recorte, tamanho, ordem }),
    staleTime: 5 * 60_000,
  })
}

/** Resumo sem filtro, usado para o último mês disponível e a última importação da planilha. */
export function useResumoGeral() {
  return useQuery(consultaResumoSemFiltro('342'))
}

/**
 * Quantidade de convênios de cada recorte inteiro (sem município), vinda da API.
 * O 342 compartilha o cache com `useResumoGeral`; só 31 e 89 geram pedidos novos.
 * Enquanto carrega, ou se falhar, o recorte fica sem número (`undefined`).
 */
export function useContagemRecortes(): Partial<Record<Recorte, number>> {
  return useQueries({
    queries: RECORTES.map((r) => consultaResumoSemFiltro(r)),
    combine: (resultados) =>
      Object.fromEntries(
        RECORTES.flatMap((r, i) => {
          const n = resultados[i].data?.convenios
          return typeof n === 'number' ? [[r, n]] : []
        }),
      ) as Partial<Record<Recorte, number>>,
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

/** Pedido único (o RJ tem 92 municípios, cabe numa página de 100) de todos os municípios do recorte. */
function consultaMunicipiosRecorte(recorte: Recorte) {
  return {
    queryKey: ['municipios-recorte', recorte],
    queryFn: async () => {
      const r = await apiGet<Municipios>('/painel/municipios', { recorte, tamanho: 100, ordem: 'municipio' })
      if (r.total > r.itens.length) {
        console.warn(`Municípios do recorte: ${r.total} municípios, só ${r.itens.length} carregados`)
      }
      return r.itens.map((i) => ({ municipio: i.municipio, convenios: i.convenios }))
    },
    staleTime: 5 * 60_000,
  }
}

/** Convênios por município no recorte inteiro (sem mês nem filtro de município), para o mapa. */
export function useMunicipiosRecorte(recorte: Recorte) {
  return useQuery(consultaMunicipiosRecorte(recorte))
}

/** Municípios com convênio no recorte, para o seletor; divide o pedido com o mapa. */
export function useOpcoesMunicipios(recorte: Recorte) {
  return useQuery({
    ...consultaMunicipiosRecorte(recorte),
    select: (linhas: { municipio: string; convenios: number }[]) => linhas.map((l) => l.municipio),
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

export function useTomadaContas(municipios: readonly string[], pagina: PaginaApi) {
  return useQuery({
    queryKey: ['tomada-contas', [...municipios].sort(), pagina],
    queryFn: () =>
      apiGet<TomadaContasResposta>('/painel/tomada-contas', {
        municipio: [...municipios],
        pagina: pagina.pagina,
        tamanho: TAMANHO_PAGINA,
        ordem: pagina.ordem,
      }),
    placeholderData: keepPreviousData,
  })
}

export function usePrestacaoContas(municipios: readonly string[], pagina: PaginaApi) {
  return useQuery({
    queryKey: ['prestacao-contas', [...municipios].sort(), pagina],
    queryFn: () =>
      apiGet<PrestacaoContasResposta>('/painel/prestacao-contas', {
        municipio: [...municipios],
        pagina: pagina.pagina,
        tamanho: TAMANHO_PAGINA,
        ordem: pagina.ordem,
      }),
    placeholderData: keepPreviousData,
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

export function useEditarConvenio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<LinhaConvenio> & { numero_convenio: string; municipio: string }) =>
      apiPut<LinhaConvenio>('/painel/convenios', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convenios'] })
      await queryClient.invalidateQueries({ queryKey: ['resumo'] })
      await queryClient.invalidateQueries({ queryKey: ['resumo-geral'] })
      await queryClient.invalidateQueries({ queryKey: ['convenio'] })
    },
  })
}

export function useEditarMunicipio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<LinhaMunicipio> & { municipio: string }) =>
      apiPut<LinhaMunicipio>('/painel/municipios', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['municipios'] })
      await queryClient.invalidateQueries({ queryKey: ['ranking-recorte'] })
      await queryClient.invalidateQueries({ queryKey: ['municipios-recorte'] })
      await queryClient.invalidateQueries({ queryKey: ['resumo'] })
    },
  })
}

export function useEditarTomadaContas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<LinhaTomadaContas> & { id: number }) =>
      apiPut<LinhaTomadaContas>(`/painel/tomada-contas/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tomada-contas'] })
      await queryClient.invalidateQueries({ queryKey: ['convenio'] })
    },
  })
}

export function useEditarPrestacaoContas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<LinhaPrestacaoContas> & { id: number }) =>
      apiPut<LinhaPrestacaoContas>(`/painel/prestacao-contas/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prestacao-contas'] })
      await queryClient.invalidateQueries({ queryKey: ['convenio'] })
    },
  })
}

export interface NovoConvenioPayload {
  numero_convenio: string
  municipio: string
  recortes: Recorte[]
  status?: string
  fase?: string
  situacao_vigencia?: string
  vigencia_inicio?: string | null
  vigencia_final?: string | null
  termo_realinhamento?: string | null
  objeto?: string | null
  codigo_seobras?: string | null
  codigo_seiop?: string | null
  cnpj?: string | null
  processo_sei?: string | null
  a_pagar?: number
  a_comprovar?: number
  a_aprovar?: number
  aprovados?: number
  valor_total?: number
  repasse_estado?: number
  contrapartida?: number
  investido_estado?: number
  a_repassar?: number
  incluir_prestacao?: boolean
  parcela?: number
  baixa_apresentacao?: string
  baixa_aprovacao?: string
  incluir_tomada?: boolean
  parecer_comissao?: string
}

export function useCriarConvenio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: NovoConvenioPayload) => apiPostJson<LinhaConvenio>('/painel/convenios', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convenios'] })
      await queryClient.invalidateQueries({ queryKey: ['municipios'] })
      await queryClient.invalidateQueries({ queryKey: ['ranking-recorte'] })
      await queryClient.invalidateQueries({ queryKey: ['municipios-recorte'] })
      await queryClient.invalidateQueries({ queryKey: ['resumo'] })
      await queryClient.invalidateQueries({ queryKey: ['resumo-geral'] })
      await queryClient.invalidateQueries({ queryKey: ['prestacao-contas'] })
      await queryClient.invalidateQueries({ queryKey: ['tomada-contas'] })
    },
  })
}

export function useRemoverConvenio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      numero,
      municipio,
      prestacao_id,
      tomada_id,
    }: {
      numero?: string | null
      municipio?: string | null
      prestacao_id?: number
      tomada_id?: number
    }) => apiDelete<{ ok: boolean }>('/painel/convenios', { numero, municipio, prestacao_id, tomada_id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['convenios'] })
      await queryClient.invalidateQueries({ queryKey: ['municipios'] })
      await queryClient.invalidateQueries({ queryKey: ['ranking-recorte'] })
      await queryClient.invalidateQueries({ queryKey: ['municipios-recorte'] })
      await queryClient.invalidateQueries({ queryKey: ['resumo'] })
      await queryClient.invalidateQueries({ queryKey: ['resumo-geral'] })
      await queryClient.invalidateQueries({ queryKey: ['prestacao-contas'] })
      await queryClient.invalidateQueries({ queryKey: ['tomada-contas'] })
      await queryClient.invalidateQueries({ queryKey: ['convenio'] })
    },
  })
}
