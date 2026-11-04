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
export type DetalheConvenio = S['DetalheConvenio']
export type ContratualRecorte = S['ContratualRecorte']
export type ExecucaoStatus = S['ExecucaoStatus']
export type Execucoes = S['Execucoes']
export type ExecucaoIniciada = S['ExecucaoIniciada']
