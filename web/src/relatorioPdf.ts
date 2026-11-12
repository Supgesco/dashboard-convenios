import { apiGet } from './api/cliente'
import type { MesConsulta } from './api/hooks'
import type {
  Convenios,
  DetalheConvenio,
  LinhaConvenio,
  LinhaMunicipio,
  LinhaPrestacaoContas,
  LinhaTomadaContas,
  Municipios,
  PrestacaoContasResposta,
  TomadaContasResposta,
} from './api/tipos'
import { AUSENTE, data, inteiro, mesAno, moeda, percentual } from './formato'
import { NOME_RECORTE, ORDEM_EXIBICAO } from './recortes'

const NOME_FASE: Record<string, string> = {
  vigente: 'Vigente',
  realinhado: 'Realinhado',
  historico: 'Histórico',
}

export interface DadosMunicipioPdf {
  resumoMunicipio?: LinhaMunicipio | null
  conveniosMunicipio?: readonly LinhaConvenio[]
  prestacoesMunicipio?: readonly LinhaPrestacaoContas[]
  tomadasMunicipio?: readonly LinhaTomadaContas[]
}

/**
 * Converte caracteres Unicode para bytes Windows-1252 (WinAnsiEncoding das fontes padrão PDF Type1)
 * e escapa parênteses e barras invertidas da sintaxe de literal string do PDF.
 */
function textoPdf(texto: string): string {
  const substituicoes: Record<string, string> = {
    '—': '-',
    '–': '-',
    '·': '-',
    '•': '*',
    '“': '"',
    '”': '"',
    '‘': "'",
    '’': "'",
    '…': '...',
  }
  const limpo = texto.replace(/[—–·•“”‘’…]/g, (c) => substituicoes[c] ?? '-')
  let out = ''
  for (let i = 0; i < limpo.length; i++) {
    const code = limpo.charCodeAt(i)
    const ch = limpo[i]
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += `\\${ch}`
    } else if (code >= 32 && code <= 126) {
      out += ch
    } else if (code >= 160 && code <= 255) {
      out += `\\${code.toString(8).padStart(3, '0')}`
    } else {
      out += '?'
    }
  }
  return out
}

/** Quebra um texto longo em linhas de até `maxChars` caracteres respeitando espaços. */
function quebrarLinhas(texto: string, maxChars: number): string[] {
  const normalizado = texto.replace(/\s+/g, ' ').trim()
  if (!normalizado) return [AUSENTE]
  const palavras = normalizado.split(' ')
  const linhas: string[] = []
  let atual = ''
  for (const p of palavras) {
    if (!atual) {
      atual = p
    } else if (atual.length + 1 + p.length <= maxChars) {
      atual += ` ${p}`
    } else {
      linhas.push(atual)
      atual = p
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

/**
 * Gera os bytes de um arquivo PDF 1.4 multi-página com o relatório completo do convênio,
 * incluindo saldos SIAFE do convênio por mês e todos os dados associados ao município.
 */
export function gerarPdfConvenio(d: DetalheConvenio, extras: DadosMunicipioPdf = {}): Uint8Array {
  const LARGURA = 595.28 // A4 retrato (pt)
  const ALTURA = 841.89
  const MARGEM = 36
  const LARGURA_UTIL = LARGURA - MARGEM * 2

  const paginas: string[][] = [[]]
  let y = ALTURA - MARGEM

  const cmd = (instrucao: string) => {
    paginas[paginas.length - 1].push(instrucao)
  }

  const novaPagina = () => {
    paginas.push([])
    y = ALTURA - MARGEM - 20
  }

  const garantirEspaco = (alturaNecessaria: number) => {
    if (y - alturaNecessaria < 56) {
      novaPagina()
    }
  }

  const retangulo = (
    x: number,
    yTopo: number,
    w: number,
    h: number,
    fillRgb?: [number, number, number],
    strokeRgb?: [number, number, number],
  ) => {
    const yBase = yTopo - h
    cmd('q')
    if (fillRgb) cmd(`${fillRgb[0].toFixed(3)} ${fillRgb[1].toFixed(3)} ${fillRgb[2].toFixed(3)} rg`)
    if (strokeRgb) {
      cmd(`${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG`)
      cmd('0.6 w')
    }
    const op = fillRgb && strokeRgb ? 'B' : fillRgb ? 'f' : 'S'
    cmd(`${x.toFixed(2)} ${yBase.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${op}`)
    cmd('Q')
  }

  const escrever = (
    texto: string,
    x: number,
    yPos: number,
    tamanho = 9.5,
    negrito = false,
    corRgb: [number, number, number] = [0.08, 0.12, 0.2],
  ) => {
    const fonte = negrito ? '/F2' : '/F1'
    cmd('BT')
    cmd(`${fonte} ${tamanho} Tf`)
    cmd(`${corRgb[0].toFixed(3)} ${corRgb[1].toFixed(3)} ${corRgb[2].toFixed(3)} rg`)
    cmd(`1 0 0 1 ${x.toFixed(2)} ${yPos.toFixed(2)} Tm`)
    cmd(`(${textoPdf(texto)}) Tj`)
    cmd('ET')
  }

  let numeroSecao = 1
  const tituloSecao = (titulo: string, subtitulo?: string) => {
    garantirEspaco(subtitulo ? 40 : 28)
    y -= 6
    retangulo(MARGEM, y, 4, 15, [0.09, 0.31, 0.64])
    escrever(`${numeroSecao}. ${titulo}`, MARGEM + 10, y - 11.5, 11.5, true, [0.08, 0.18, 0.37])
    numeroSecao += 1
    y -= 18
    if (subtitulo) {
      escrever(subtitulo, MARGEM + 10, y - 8, 8.5, false, [0.38, 0.45, 0.55])
      y -= 14
    }
    y -= 4
  }

  // --- Cabeçalho Institucional ---
  const alturaCabecalho = 78
  retangulo(MARGEM, y, LARGURA_UTIL, alturaCabecalho, [0.08, 0.18, 0.37])
  retangulo(MARGEM, y - alturaCabecalho + 3.5, LARGURA_UTIL, 3.5, [0.2, 0.83, 0.6])

  escrever(
    'PAINEL DE CONVÊNIOS · FAZENDA RJ / SEIOP · SIAFE',
    MARGEM + 16,
    y - 20,
    8.5,
    true,
    [0.65, 0.85, 0.98],
  )
  escrever(
    `Relatório do Convênio ${d.numero_convenio} - ${d.municipio}`,
    MARGEM + 16,
    y - 41,
    15,
    true,
    [1, 1, 1],
  )

  const refTexto = `Referência SIAFE: ${mesAno(d.referencia.ano, d.referencia.mes)}`
  const statusTexto = [d.status, d.situacao_vigencia].filter(Boolean).join(' · ') || AUSENTE
  escrever(`${refTexto}   |   Status: ${statusTexto}`, MARGEM + 16, y - 60, 9, false, [0.85, 0.92, 0.99])

  y -= alturaCabecalho + 14

  // --- Bloco 1: Identificação e Metadados ---
  tituloSecao('Identificação do Convênio e do Município')

  const recortesNomes =
    ORDEM_EXIBICAO.filter((r) => d.recortes.includes(r))
      .map((r) => NOME_RECORTE[r])
      .join(', ') || AUSENTE

  const cnpjMunicipio =
    d.prestacao_contas?.find((p) => Boolean(p.cnpj))?.cnpj ??
    extras.prestacoesMunicipio?.find((p) => Boolean(p.cnpj))?.cnpj ??
    null

  const paresIdentificacao: [string, string][] = [
    ['Número do Convênio', d.numero_convenio],
    ['Município', cnpjMunicipio ? `${d.municipio} (CNPJ: ${cnpjMunicipio})` : d.municipio],
    ['Fim da Vigência', data(d.vigencia_final)],
    ['Fase', NOME_FASE[d.fase] ?? d.fase],
    ['Processo Celebração', d.processo_celebracao ?? AUSENTE],
    ['Código SEOBRAS', d.codigo_seobras ?? AUSENTE],
    ['Código SEIOP', d.codigo_seiop ?? AUSENTE],
    ['Recortes', recortesNomes],
    ['Status / Situação da Vigência', statusTexto],
    ['Código SIAFE Compartilhado', d.codigo_compartilhado ? 'Sim' : 'Não'],
  ]

  const colW = (LARGURA_UTIL - 12) / 2
  const altCelula = 30
  for (let i = 0; i < paresIdentificacao.length; i += 2) {
    garantirEspaco(altCelula + 6)
    for (let c = 0; c < 2; c++) {
      const par = paresIdentificacao[i + c]
      if (!par) continue
      const x = MARGEM + c * (colW + 12)
      retangulo(x, y, colW, altCelula, [0.97, 0.98, 0.99], [0.88, 0.91, 0.95])
      escrever(par[0].toUpperCase(), x + 10, y - 11, 7.2, true, [0.4, 0.47, 0.56])
      escrever(par[1], x + 10, y - 23.5, 9, true, [0.08, 0.12, 0.2])
    }
    y -= altCelula + 6
  }

  if (d.codigo_compartilhado && d.compartilhado_com.length > 0) {
    const compartilhadosTxt = d.compartilhado_com
      .map((c) => `${c.numero_convenio} - ${c.municipio} (cód. ${c.codigo})`)
      .join('; ')
    const linhasComp = quebrarLinhas(compartilhadosTxt, 92)
    const altComp = 22 + linhasComp.length * 12
    garantirEspaco(altComp + 8)
    retangulo(MARGEM, y, LARGURA_UTIL, altComp, [1.0, 0.98, 0.92], [0.95, 0.85, 0.65])
    escrever('COMPARTILHADO COM OUTROS CONVÊNIOS', MARGEM + 10, y - 11, 7.2, true, [0.55, 0.32, 0.05])
    linhasComp.forEach((linha, idx) => {
      escrever(linha, MARGEM + 10, y - 23 - idx * 12, 8.5, false, [0.35, 0.22, 0.05])
    })
    y -= altComp + 8
  }

  // Caixa do Objeto
  const linhasObjeto = quebrarLinhas(d.objeto ?? AUSENTE, 92)
  const altObjeto = 24 + linhasObjeto.length * 12.5
  garantirEspaco(altObjeto + 10)
  retangulo(MARGEM, y, LARGURA_UTIL, altObjeto, [0.97, 0.98, 0.99], [0.88, 0.91, 0.95])
  escrever('OBJETO DO CONVÊNIO', MARGEM + 10, y - 12, 7.2, true, [0.4, 0.47, 0.56])
  linhasObjeto.forEach((linha, idx) => {
    escrever(linha, MARGEM + 10, y - 25 - idx * 12.5, 9, false, [0.12, 0.16, 0.23])
  })
  y -= altObjeto + 12

  // --- Bloco 2: Saldos SIAFE do Mês de Referência ---
  const { ano, mes } = d.referencia
  const nomeMesAnt = mes === 1 ? mesAno(ano - 1, 12) : mesAno(ano, mes - 1)
  tituloSecao('Saldos Contábeis SIAFE', `Posição em ${mesAno(ano, mes)} comparada a ${nomeMesAnt}`)

  const saldosItens: [string, number | null | undefined, number | null | undefined][] = [
    ['A pagar', d.saldos?.a_pagar, d.mes_anterior?.a_pagar],
    ['A comprovar', d.saldos?.a_comprovar, d.mes_anterior?.a_comprovar],
    ['A aprovar', d.saldos?.a_aprovar, d.mes_anterior?.a_aprovar],
    ['Aprovados', d.saldos?.aprovados, d.mes_anterior?.aprovados],
  ]

  const cardSaldoW = (LARGURA_UTIL - 18) / 4
  const cardSaldoH = 48
  garantirEspaco(cardSaldoH + 12)
  saldosItens.forEach(([rotulo, atual, ant], idx) => {
    const x = MARGEM + idx * (cardSaldoW + 6)
    retangulo(x, y, cardSaldoW, cardSaldoH, [0.96, 0.98, 1.0], [0.82, 0.88, 0.96])
    escrever(rotulo.toUpperCase(), x + 8, y - 12, 7.2, true, [0.09, 0.31, 0.64])
    escrever(moeda(atual), x + 8, y - 26, 10, true, [0.06, 0.09, 0.16])
    escrever(
      `Em ${nomeMesAnt}: ${ant !== null && ant !== undefined ? moeda(ant) : AUSENTE}`,
      x + 8,
      y - 40,
      7.2,
      false,
      [0.4, 0.47, 0.56],
    )
  })
  y -= cardSaldoH + 14

  // --- Bloco 3: Saldos SIAFE do convênio por mês (Série Histórica) ---
  tituloSecao(
    'Saldos SIAFE do Convênio por Mês',
    d.serie.length > 0
      ? `Evolução mensal registrada no SIAFE (${d.serie.length} ${d.serie.length === 1 ? 'mês' : 'meses'})`
      : 'Evolução mensal registrada no SIAFE',
  )
  if (d.serie.length === 0) {
    garantirEspaco(28)
    retangulo(MARGEM, y, LARGURA_UTIL, 24, [0.98, 0.98, 0.99], [0.88, 0.91, 0.95])
    escrever('Não há série mensal do SIAFE disponível para este convênio.', MARGEM + 10, y - 15, 8.5, false, [
      0.38,
      0.45,
      0.55,
    ])
    y -= 32
  } else {
    const altCabSerie = 20
    garantirEspaco(altCabSerie + 20)
    retangulo(MARGEM, y, LARGURA_UTIL, altCabSerie, [0.91, 0.94, 0.98], [0.82, 0.87, 0.93])
    escrever('MÊS / ANO', MARGEM + 10, y - 13, 7.2, true, [0.2, 0.28, 0.4])
    escrever('A PAGAR', MARGEM + 115, y - 13, 7.2, true, [0.2, 0.28, 0.4])
    escrever('A COMPROVAR', MARGEM + 220, y - 13, 7.2, true, [0.2, 0.28, 0.4])
    escrever('A APROVAR', MARGEM + 325, y - 13, 7.2, true, [0.2, 0.28, 0.4])
    escrever('APROVADOS', MARGEM + 425, y - 13, 7.2, true, [0.2, 0.28, 0.4])
    y -= altCabSerie

    d.serie.forEach((ponto, idx) => {
      const altLinha = 18
      garantirEspaco(altLinha + 4)
      const bg: [number, number, number] = idx % 2 === 0 ? [1, 1, 1] : [0.97, 0.98, 1.0]
      retangulo(MARGEM, y, LARGURA_UTIL, altLinha, bg, [0.9, 0.92, 0.96])
      escrever(mesAno(ponto.ano, ponto.mes), MARGEM + 10, y - 12, 8, true)
      escrever(moeda(ponto.a_pagar), MARGEM + 115, y - 12, 8)
      escrever(moeda(ponto.a_comprovar), MARGEM + 220, y - 12, 8)
      escrever(moeda(ponto.a_aprovar), MARGEM + 325, y - 12, 8)
      escrever(moeda(ponto.aprovados), MARGEM + 425, y - 12, 8)
      y -= altLinha
    })
    y -= 10
  }

  // --- Bloco 4: Valores Contratuais ---
  tituloSecao('Valores Contratuais por Recorte')
  if (d.contratual.length === 0) {
    garantirEspaco(28)
    retangulo(MARGEM, y, LARGURA_UTIL, 24, [0.98, 0.98, 0.99], [0.88, 0.91, 0.95])
    escrever(
      'Não há valores contratuais para este convênio (presente apenas no Histórico inicial).',
      MARGEM + 10,
      y - 15,
      8.5,
      false,
      [0.38, 0.45, 0.55],
    )
    y -= 32
  } else {
    for (const c of d.contratual) {
      const altBloco = 62
      garantirEspaco(altBloco + 10)
      retangulo(MARGEM, y, LARGURA_UTIL, altBloco, [0.97, 0.99, 0.98], [0.8, 0.9, 0.85])
      escrever(
        `${NOME_RECORTE[c.recorte].toUpperCase()}  ·  Execução: ${percentual(c.execucao_pct)}  ·  Investido / Valor Total: ${percentual(c.investido_sobre_total_pct)}`,
        MARGEM + 10,
        y - 13,
        8.2,
        true,
        [0.04, 0.42, 0.29],
      )
      const metricas: [string, string][] = [
        ['Valor Total', moeda(c.valor_total)],
        ['Repasse Estado', moeda(c.repasse_estado)],
        ['Contrapartida', moeda(c.contrapartida)],
        ['Investido Estado', moeda(c.investido_estado)],
        ['A Repassar', moeda(c.a_repassar)],
      ]
      const mW = (LARGURA_UTIL - 20) / 5
      metricas.forEach(([rot, val], idx) => {
        const mx = MARGEM + 10 + idx * mW
        escrever(rot, mx, y - 31, 7.2, false, [0.38, 0.45, 0.55])
        escrever(val, mx, y - 45, 8.8, true, [0.08, 0.12, 0.2])
      })
      y -= altBloco + 8
    }
  }

  // --- Bloco 5: Tomada de Contas do Convênio (se houver) ---
  if (d.tomada_contas) {
    tituloSecao('Tomada de Contas Especial do Convênio')
    const tc = d.tomada_contas
    const linhasParecer = quebrarLinhas(`Parecer da Comissão: ${tc.parecer_comissao ?? AUSENTE}`, 92)
    const linhasObjTc = tc.objeto ? quebrarLinhas(`Objeto TCE: ${tc.objeto}`, 92) : []
    const altTc = 30 + (linhasParecer.length + linhasObjTc.length) * 12
    garantirEspaco(altTc + 10)
    retangulo(MARGEM, y, LARGURA_UTIL, altTc, [1.0, 0.98, 0.95], [0.95, 0.85, 0.7])
    escrever(`Valor SIAFE: ${moeda(tc.valor_siafe)}`, MARGEM + 10, y - 15, 8.5, true, [0.55, 0.25, 0.04])
    escrever(`Processo SEI: ${tc.processo_sei ?? AUSENTE}`, MARGEM + 165, y - 15, 8.5, true, [0.15, 0.2, 0.3])
    escrever(`Cód. SEOBRAS: ${tc.codigo_seobras ?? AUSENTE}`, MARGEM + 320, y - 15, 8.2, false, [0.15, 0.2, 0.3])
    escrever(`Status: ${tc.status ?? AUSENTE}`, MARGEM + 435, y - 15, 8.2, true, [0.15, 0.2, 0.3])
    let yTc = y - 31
    linhasParecer.forEach((l) => {
      escrever(l, MARGEM + 10, yTc, 8, false, [0.25, 0.3, 0.38])
      yTc -= 12
    })
    linhasObjTc.forEach((l) => {
      escrever(l, MARGEM + 10, yTc, 8, false, [0.3, 0.35, 0.42])
      yTc -= 12
    })
    y -= altTc + 12
  }

  // --- Bloco 6: Prestação de Contas · Parcelas do Convênio (se houver) ---
  if (d.prestacao_contas && d.prestacao_contas.length > 0) {
    tituloSecao(`Prestação de Contas · Parcelas do Convênio (${d.prestacao_contas.length})`)
    const altCab = 20
    garantirEspaco(altCab + 28)
    retangulo(MARGEM, y, LARGURA_UTIL, altCab, [0.91, 0.94, 0.98], [0.82, 0.87, 0.93])
    escrever('PARC.', MARGEM + 6, y - 13, 7, true, [0.2, 0.28, 0.4])
    escrever('REPASSE', MARGEM + 40, y - 13, 7, true, [0.2, 0.28, 0.4])
    escrever('EXECUTADO', MARGEM + 120, y - 13, 7, true, [0.2, 0.28, 0.4])
    escrever('PROCESSO', MARGEM + 200, y - 13, 7, true, [0.2, 0.28, 0.4])
    escrever('BAIXA APRES. / APROV.', MARGEM + 295, y - 13, 7, true, [0.2, 0.28, 0.4])
    escrever('SITUAÇÃO', MARGEM + 425, y - 13, 7, true, [0.2, 0.28, 0.4])
    y -= altCab

    d.prestacao_contas.forEach((p, idx) => {
      const temObs = Boolean(p.observacao && p.observacao.trim())
      const altLinha = temObs ? 30 : 18
      garantirEspaco(altLinha + 4)
      const bg: [number, number, number] = idx % 2 === 0 ? [1, 1, 1] : [0.97, 0.98, 1.0]
      retangulo(MARGEM, y, LARGURA_UTIL, altLinha, bg, [0.9, 0.92, 0.96])
      escrever(p.parcela !== null && p.parcela !== undefined ? `${p.parcela}ª` : AUSENTE, MARGEM + 6, y - 12, 7.8, true)
      escrever(moeda(p.valor_repasse), MARGEM + 40, y - 12, 7.8)
      escrever(moeda(p.valor_executado), MARGEM + 120, y - 12, 7.8)
      escrever((p.processo ?? AUSENTE).slice(0, 20), MARGEM + 200, y - 12, 7.5)
      const baixas = `${p.baixa_apresentacao ?? AUSENTE} / ${p.baixa_aprovacao ?? AUSENTE}`
      escrever(baixas.slice(0, 28), MARGEM + 295, y - 12, 7.2)
      escrever((p.situacao ?? AUSENTE).slice(0, 20), MARGEM + 425, y - 12, 7.5)
      if (temObs) {
        escrever(`Obs.: ${(p.observacao ?? '').slice(0, 100)}`, MARGEM + 6, y - 24, 7, false, [0.4, 0.46, 0.54])
      }
      y -= altLinha
    })
    y -= 10
  }

  // --- Bloco 7: Dados Consolidados e Todos os Convênios Associados ao Município ---
  const rm = extras.resumoMunicipio
  const convsMun = extras.conveniosMunicipio ?? []
  const prestMun = extras.prestacoesMunicipio ?? []
  const tomMun = extras.tomadasMunicipio ?? []

  if (rm || convsMun.length > 0 || prestMun.length > 0 || tomMun.length > 0) {
    tituloSecao(
      `Panorama Geral do Município · ${d.municipio}`,
      'Totais consolidados e relação completa de convênios, prestações e tomadas de contas associados ao município',
    )

    if (rm) {
      const altResumoMun = 62
      garantirEspaco(altResumoMun + 10)
      retangulo(MARGEM, y, LARGURA_UTIL, altResumoMun, [0.96, 0.98, 1.0], [0.82, 0.88, 0.96])
      escrever(
        `TOTAIS CONSOLIDADOS DE ${d.municipio.toUpperCase()} (${inteiro(rm.convenios)} ${rm.convenios === 1 ? 'CONVÊNIO' : 'CONVÊNIOS'})`,
        MARGEM + 10,
        y - 13,
        8.2,
        true,
        [0.08, 0.18, 0.37],
      )
      const metricasMun: [string, string][] = [
        ['A Pagar (SIAFE)', moeda(rm.a_pagar)],
        ['A Comprovar (SIAFE)', moeda(rm.a_comprovar)],
        ['A Aprovar (SIAFE)', moeda(rm.a_aprovar)],
        ['Aprovados (SIAFE)', moeda(rm.aprovados)],
        ['Valor Total Contratual', moeda(rm.valor_total)],
      ]
      const mW = (LARGURA_UTIL - 20) / 5
      metricasMun.forEach(([rot, val], idx) => {
        const mx = MARGEM + 10 + idx * mW
        escrever(rot, mx, y - 31, 7.2, false, [0.38, 0.45, 0.55])
        escrever(val, mx, y - 45, 8.5, true, [0.08, 0.12, 0.2])
      })
      y -= altResumoMun + 10
    }

    if (convsMun.length > 0) {
      garantirEspaco(42)
      escrever(
        `Relação de Convênios do Município (${convsMun.length}):`,
        MARGEM,
        y - 10,
        9,
        true,
        [0.08, 0.18, 0.37],
      )
      y -= 16
      const altCab = 20
      retangulo(MARGEM, y, LARGURA_UTIL, altCab, [0.91, 0.94, 0.98], [0.82, 0.87, 0.93])
      escrever('Nº CONVÊNIO', MARGEM + 6, y - 13, 7, true, [0.2, 0.28, 0.4])
      escrever('FASE / STATUS', MARGEM + 82, y - 13, 7, true, [0.2, 0.28, 0.4])
      escrever('SEOBRAS / SEIOP', MARGEM + 205, y - 13, 7, true, [0.2, 0.28, 0.4])
      escrever('A PAGAR', MARGEM + 305, y - 13, 7, true, [0.2, 0.28, 0.4])
      escrever('APROVADOS', MARGEM + 390, y - 13, 7, true, [0.2, 0.28, 0.4])
      escrever('VALOR TOTAL', MARGEM + 460, y - 13, 7, true, [0.2, 0.28, 0.4])
      y -= altCab

      convsMun.forEach((c, idx) => {
        const altLinha = 18
        garantirEspaco(altLinha + 4)
        const bg: [number, number, number] = idx % 2 === 0 ? [1, 1, 1] : [0.97, 0.98, 1.0]
        retangulo(MARGEM, y, LARGURA_UTIL, altLinha, bg, [0.9, 0.92, 0.96])
        escrever(c.numero_convenio, MARGEM + 6, y - 12, 7.8, true)
        const faseStatus = `${NOME_FASE[c.fase] ?? c.fase}${c.status ? ` · ${c.status}` : ''}`
        escrever(faseStatus.slice(0, 26), MARGEM + 82, y - 12, 7.2)
        escrever(`${c.codigo_seobras ?? AUSENTE} / ${c.codigo_seiop ?? AUSENTE}`, MARGEM + 205, y - 12, 7.2)
        escrever(moeda(c.a_pagar), MARGEM + 305, y - 12, 7.5)
        escrever(moeda(c.aprovados), MARGEM + 390, y - 12, 7.5)
        escrever(moeda(c.valor_total), MARGEM + 460, y - 12, 7.5)
        y -= altLinha
      })
      y -= 10
    }

    const outrasTomadas = tomMun.filter((t) => t.numero_convenio !== d.numero_convenio)
    if (outrasTomadas.length > 0) {
      garantirEspaco(36)
      escrever(
        `Outros Processos de Tomada de Contas do Município (${outrasTomadas.length}):`,
        MARGEM,
        y - 10,
        9,
        true,
        [0.08, 0.18, 0.37],
      )
      y -= 16
      outrasTomadas.forEach((t) => {
        const altLinha = 20
        garantirEspaco(altLinha + 4)
        retangulo(MARGEM, y, LARGURA_UTIL, altLinha, [1.0, 0.98, 0.95], [0.95, 0.85, 0.7])
        escrever(
          `Convênio ${t.numero_convenio}  |  Valor SIAFE: ${moeda(t.valor_siafe)}  |  Processo SEI: ${t.processo_sei ?? AUSENTE}  |  Status: ${t.status ?? AUSENTE}`,
          MARGEM + 8,
          y - 13,
          7.8,
          false,
          [0.2, 0.25, 0.35],
        )
        y -= altLinha + 3
      })
      y -= 6
    }

    const outrasPrestacoes = prestMun.filter((p) => p.numero_convenio !== d.numero_convenio)
    if (outrasPrestacoes.length > 0) {
      garantirEspaco(36)
      escrever(
        `Outras Parcelas de Prestação de Contas do Município (${outrasPrestacoes.length}):`,
        MARGEM,
        y - 10,
        9,
        true,
        [0.08, 0.18, 0.37],
      )
      y -= 16
      outrasPrestacoes.forEach((p, idx) => {
        const altLinha = 18
        garantirEspaco(altLinha + 4)
        const bg: [number, number, number] = idx % 2 === 0 ? [1, 1, 1] : [0.97, 0.98, 1.0]
        retangulo(MARGEM, y, LARGURA_UTIL, altLinha, bg, [0.9, 0.92, 0.96])
        escrever(
          `Conv. ${p.numero_convenio} (${p.parcela ? `${p.parcela}ª parc.` : AUSENTE}) · Repasse: ${moeda(p.valor_repasse)} · Executado: ${moeda(p.valor_executado)} · ${(p.situacao ?? AUSENTE).slice(0, 28)}`,
          MARGEM + 8,
          y - 12,
          7.5,
        )
        y -= altLinha
      })
      y -= 6
    }
  }

  // --- Rodapé em todas as páginas ---
  const totalPaginas = paginas.length
  const emitidoEm = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())

  paginas.forEach((comandosPagina, idx) => {
    const rodape: string[] = []
    const pushR = (s: string) => rodape.push(s)
    pushR('q 0.85 0.88 0.92 RG 0.5 w')
    pushR(`${MARGEM.toFixed(2)} 40.00 m ${(LARGURA - MARGEM).toFixed(2)} 40.00 l S Q`)
    pushR('BT /F1 7.5 Tf 0.45 0.50 0.58 rg')
    pushR(`1 0 0 1 ${MARGEM.toFixed(2)} 27.00 Tm`)
    pushR(`(${textoPdf(`Painel de Convênios · Emitido em ${emitidoEm}`)}) Tj ET`)
    pushR('BT /F2 7.5 Tf 0.35 0.42 0.52 rg')
    pushR(`1 0 0 1 ${(LARGURA - MARGEM - 62).toFixed(2)} 27.00 Tm`)
    pushR(`(${textoPdf(`Página ${idx + 1} de ${totalPaginas}`)}) Tj ET`)
    comandosPagina.push(...rodape)
  })

  // --- Montagem dos objetos PDF 1.4 ---
  const objetos: string[] = []
  const idsPaginas: number[] = []

  objetos.push('<< /Type /Catalog /Pages 2 0 R >>') // 1
  objetos.push('') // 2 (preenchido após criar páginas)
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>') // 3
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>') // 4

  for (const comandosPagina of paginas) {
    const stream = comandosPagina.join('\n')
    const idConteudo = objetos.length + 1
    objetos.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    const idPagina = objetos.length + 1
    idsPaginas.push(idPagina)
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA.toFixed(2)} ${ALTURA.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idConteudo} 0 R >>`,
    )
  }

  objetos[1] = `<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(' ')}] /Count ${idsPaginas.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let i = 0; i < objetos.length; i++) {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${objetos[i]}\nendobj\n`
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objetos.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  const bytes = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff
  }
  return bytes
}

export function nomeArquivoPdfConvenio(numero: string, municipio: string): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return `relatorio-convenio-${slug(numero)}-${slug(municipio)}.pdf`
}

export function baixarRelatorioPdfConvenio(d: DetalheConvenio, extras: DadosMunicipioPdf = {}): void {
  const bytes = gerarPdfConvenio(d, extras)
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivoPdfConvenio(d.numero_convenio, d.municipio)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function carregarDadosMunicipioPdf(
  municipio: string,
  mes?: MesConsulta,
): Promise<DadosMunicipioPdf> {
  const [munsResp, convsResp, prestResp, tomResp] = await Promise.all([
    apiGet<Municipios>('/painel/municipios', {
      recorte: '342',
      municipio: [municipio],
      ano: mes?.ano,
      mes: mes?.mes,
      pagina: 1,
      tamanho: 20,
    }).catch(() => null),
    apiGet<Convenios>('/painel/convenios', {
      recorte: '342',
      municipio: [municipio],
      ano: mes?.ano,
      mes: mes?.mes,
      pagina: 1,
      tamanho: 100,
    }).catch(() => null),
    apiGet<PrestacaoContasResposta>('/painel/prestacao-contas', {
      municipio: [municipio],
      pagina: 1,
      tamanho: 100,
    }).catch(() => null),
    apiGet<TomadaContasResposta>('/painel/tomada-contas', {
      municipio: [municipio],
      pagina: 1,
      tamanho: 100,
    }).catch(() => null),
  ])

  return {
    resumoMunicipio: munsResp?.itens?.[0] ?? null,
    conveniosMunicipio: convsResp?.itens ?? [],
    prestacoesMunicipio: prestResp?.itens ?? [],
    tomadasMunicipio: tomResp?.itens ?? [],
  }
}

export async function exportarPdfCompletoConvenio(d: DetalheConvenio): Promise<void> {
  const extras = await carregarDadosMunicipioPdf(d.municipio, d.referencia)
  baixarRelatorioPdfConvenio(d, extras)
}

export async function exportarPdfPorChave(
  numero: string,
  municipio: string,
  mes?: MesConsulta,
): Promise<void> {
  const [detalhe, extras] = await Promise.all([
    apiGet<DetalheConvenio>('/painel/convenio', {
      numero,
      municipio,
      ano: mes?.ano,
      mes: mes?.mes,
    }),
    carregarDadosMunicipioPdf(municipio, mes),
  ])
  baixarRelatorioPdfConvenio(detalhe, extras)
}
