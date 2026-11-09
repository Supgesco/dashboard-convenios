// Atalhos para os modelos de resposta da API (gerados em schema.d.ts).
import type { components } from './schema'

type S = components['schemas']

export type Recorte = '31' | '89' | '342'
export const RECORTES: readonly Recorte[] = ['31', '89', '342']

export type Saldos = S['Saldos']
export type Contratual = S['Contratual']
export type Resumo = S['Resumo']
export type Serie = S['Serie']
export type PontoSerie = S['PontoSerie']
export type Municipios = S['Municipios']
export type LinhaMunicipio = S['LinhaMunicipio']
export type Convenios = S['Convenios']
export type LinhaConvenio = S['LinhaConvenio']
export type DetalheConvenio = S['DetalheConvenio'] & {
  tomada_contas?: LinhaTomadaContas | null
  prestacao_contas?: LinhaPrestacaoContas[]
}
export type ContratualRecorte = S['ContratualRecorte']
export type ExecucaoStatus = S['ExecucaoStatus']
export type Execucoes = S['Execucoes']
export type ExecucaoIniciada = S['ExecucaoIniciada']

export interface LinhaTomadaContas {
  id: number
  municipio: string
  numero_convenio: string
  codigo_seobras: string | null
  valor_siafe: number | null
  objeto: string | null
  parecer_comissao: string | null
  processo_sei: string | null
  status: string | null
}

export interface TomadaContasResposta {
  municipios: string[]
  pagina: number
  tamanho: number
  total: number
  itens: LinhaTomadaContas[]
}

export interface LinhaPrestacaoContas {
  id: number
  item: number | null
  municipio: string
  cnpj: string | null
  numero_convenio: string
  codigo_seobras: string | null
  codigo_seiop: string | null
  parcela: number | null
  valor_repasse: number | null
  processo: string | null
  valor_executado: number | null
  baixa_apresentacao: string | null
  baixa_aprovacao: string | null
  observacao: string | null
  situacao: string | null
}

export interface PrestacaoContasResposta {
  municipios: string[]
  pagina: number
  tamanho: number
  total: number
  itens: LinhaPrestacaoContas[]
}
