// Respostas sintéticas no formato da API (tipadas pelos tipos gerados). Números e valores inventados.
import type {
  Convenios,
  DetalheConvenio,
  ExecucaoStatus,
  Execucoes,
  LinhaConvenio,
  LinhaMunicipio,
  Municipios,
  Recorte,
  Resumo,
  Serie,
} from '../api/tipos'

export const saldos = { a_pagar: 1000, a_comprovar: 200, a_aprovar: 30, aprovados: 4 }
export const contratual = {
  valor_total: 5000,
  repasse_estado: 4000,
  contrapartida: 1000,
  investido_estado: 1820,
  a_repassar: 2180,
  execucao_pct: 45.5,
  investido_sobre_total_pct: 36.4,
}

export function resumo(parcial: Partial<Resumo> = {}): Resumo {
  const recorte = parcial.recorte ?? '31'
  return {
    recorte,
    municipios: [],
    convenios: 12,
    referencia: {
      ano: 2026,
      mes: 10,
      posicao_siafe_em: '2026-11-03T12:00:00Z',
      planilha_importada_em: '2026-11-01T15:00:00Z',
      arquivo: 'planilha-sintetica.xlsx',
      ultimo_mes_disponivel: { ano: 2026, mes: 10 },
    },
    siafe: {
      ...saldos,
      mes_anterior: { a_pagar: 800, a_comprovar: 200, a_aprovar: null, aprovados: 0 },
      cobertura: { vinculado: saldos, total_siafe: { a_pagar: 2000, a_comprovar: 400, a_aprovar: 60, aprovados: 8 } },
    },
    contratual: recorte === '342' ? null : contratual,
    situacao:
      recorte === '342'
        ? {
            status: [
              { valor: 'EM EXECUÇÃO', convenios: 7 },
              { valor: null, convenios: 2 },
            ],
            situacao_vigencia: [{ valor: 'VIGENTE', convenios: 9 }],
          }
        : null,
    ...parcial,
  }
}

export function serie(n = 3): Serie {
  return {
    recorte: '31',
    municipios: [],
    pontos: Array.from({ length: n }, (_, i) => ({
      ano: 2026,
      mes: i + 1,
      ...saldos,
      a_aprovar: i === 1 ? null : saldos.a_aprovar,
    })),
  }
}

export function linhaMunicipio(municipio: string, parcial: Partial<LinhaMunicipio> = {}): LinhaMunicipio {
  return { municipio, convenios: 2, codigo_compartilhado: false, ...saldos, ...contratual, ...parcial }
}

export function municipios(itens: LinhaMunicipio[], parcial: Partial<Municipios> = {}): Municipios {
  return {
    recorte: '31',
    ano: 2026,
    mes: 10,
    municipios: [],
    pagina: 1,
    tamanho: 20,
    total: itens.length,
    itens,
    ...parcial,
  }
}

export function linhaConvenio(numero: string, municipio: string, parcial: Partial<LinhaConvenio> = {}): LinhaConvenio {
  return {
    numero_convenio: numero,
    municipio,
    status: 'EM EXECUÇÃO',
    fase: 'vigente',
    codigo_seobras: '000101',
    codigo_seiop: null,
    codigo_compartilhado: false,
    ...saldos,
    ...contratual,
    ...parcial,
  }
}

export function convenios(itens: LinhaConvenio[], parcial: Partial<Convenios> = {}): Convenios {
  return {
    recorte: '31',
    ano: 2026,
    mes: 10,
    municipios: [],
    pagina: 1,
    tamanho: 20,
    total: itens.length,
    itens,
    ...parcial,
  }
}

export function detalhe(parcial: Partial<DetalheConvenio> = {}): DetalheConvenio {
  const recortes: Recorte[] = ['31', '89', '342']
  return {
    numero_convenio: '901/2020',
    municipio: 'Paraty',
    fase: 'vigente',
    status: 'EM EXECUÇÃO',
    situacao_vigencia: 'VIGENTE',
    vigencia_final: '2027-06-30',
    objeto: 'Obra sintética de teste',
    recortes,
    codigo_seobras: '000101',
    codigo_seiop: '000202',
    codigo_compartilhado: false,
    compartilhado_com: [],
    referencia: { ano: 2026, mes: 10 },
    saldos,
    mes_anterior: { a_pagar: 900, a_comprovar: null, a_aprovar: 30, aprovados: 4 },
    contratual: [
      { recorte: '31', ...contratual },
      { recorte: '89', ...contratual, valor_total: 6000 },
    ],
    serie: serie(3).pontos,
    ...parcial,
  }
}

export function execucao(id: number, parcial: Partial<ExecucaoStatus> = {}): ExecucaoStatus {
  return {
    id,
    origem: 'http',
    status: 'sucesso',
    inicio: '2026-11-03T12:00:00Z',
    fim: '2026-11-03T12:05:00Z',
    registros: 1234,
    erro: null,
    ...parcial,
  }
}

export function execucoes(itens: ExecucaoStatus[], parcial: Partial<Execucoes> = {}): Execucoes {
  return { pagina: 1, tamanho: 20, total: itens.length, itens, ...parcial }
}
