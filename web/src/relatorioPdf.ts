import { apiGet } from './api/cliente'
import type { MesConsulta } from './api/hooks'
import type { DetalheConvenio } from './api/tipos'
import { AUSENTE, data, mesAno, moeda, percentual } from './formato'
import { NOME_RECORTE, ORDEM_EXIBICAO } from './recortes'

const NOME_FASE: Record<string, string> = {
  vigente: 'Vigente',
  realinhado: 'Realinhado',
  historico: 'Histórico',
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
 * Gera os bytes de um arquivo PDF 1.4 multi-página com o relatório completo de um convênio.
 */
export function gerarPdfConvenio(d: DetalheConvenio): Uint8Array {
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

  const tituloSecao = (titulo: string, subtitulo?: string) => {
    garantirEspaco(subtitulo ? 40 : 28)
    y -= 6
    retangulo(MARGEM, y, 4, 15, [0.09, 0.31, 0.64])
    escrever(titulo, MARGEM + 10, y - 11.5, 11.5, true, [0.08, 0.18, 0.37])
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
  tituloSecao('1. Identificação do Convênio')

  const recortesNomes =
    ORDEM_EXIBICAO.filter((r) => d.recortes.includes(r))
      .map((r) => NOME_RECORTE[r])
      .join(', ') || AUSENTE

  const paresIdentificacao: [string, string][] = [
    ['Número do Convênio', d.numero_convenio],
    ['Município', d.municipio],
    ['Fim da Vigência', data(d.vigencia_final)],
    ['Fase', NOME_FASE[d.fase] ?? d.fase],
    ['Processo Celebração', d.processo_celebracao ?? AUSENTE],
    ['Código SEOBRAS', d.codigo_seobras ?? AUSENTE],
    ['Código SEIOP', d.codigo_seiop ?? AUSENTE],
    ['Recortes', recortesNomes],
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
      escrever(par[1], x + 10, y - 23.5, 9.5, true, [0.08, 0.12, 0.2])
    }
    y -= altCelula + 6
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

  // --- Bloco 2: Saldos SIAFE ---
  const { ano, mes } = d.referencia
  const nomeMesAnt = mes === 1 ? mesAno(ano - 1, 12) : mesAno(ano, mes - 1)
  tituloSecao('2. Saldos Contábeis SIAFE', `Posição em ${mesAno(ano, mes)} comparada a ${nomeMesAnt}`)

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

  // --- Bloco 3: Valores Contratuais ---
  tituloSecao('3. Valores Contratuais por Recorte')
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
        `${NOME_RECORTE[c.recorte].toUpperCase()}  ·  Execução: ${percentual(c.execucao_pct)}`,
        MARGEM + 10,
        y - 13,
        8.5,
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

  // --- Bloco 4: Tomada de Contas (se houver) ---
  if (d.tomada_contas) {
    tituloSecao('4. Tomada de Contas Especial')
    const tc = d.tomada_contas
    const altTc = 48
    garantirEspaco(altTc + 10)
    retangulo(MARGEM, y, LARGURA_UTIL, altTc, [1.0, 0.98, 0.95], [0.95, 0.85, 0.7])
    escrever(`Valor SIAFE: ${moeda(tc.valor_siafe)}`, MARGEM + 10, y - 15, 8.8, true, [0.55, 0.25, 0.04])
    escrever(`Processo SEI: ${tc.processo_sei ?? AUSENTE}`, MARGEM + 180, y - 15, 8.8, true, [0.15, 0.2, 0.3])
    escrever(`Status: ${tc.status ?? AUSENTE}`, MARGEM + 360, y - 15, 8.5, false, [0.15, 0.2, 0.3])
    escrever(
      `Parecer da Comissão: ${(tc.parecer_comissao ?? AUSENTE).slice(0, 95)}`,
      MARGEM + 10,
      y - 34,
      8.2,
      false,
      [0.3, 0.35, 0.42],
    )
    y -= altTc + 12
  }

  // --- Bloco 5: Prestação de Contas · Parcelas (se houver) ---
  if (d.prestacao_contas && d.prestacao_contas.length > 0) {
    tituloSecao(
      `${d.tomada_contas ? '5' : '4'}. Prestação de Contas · Parcelas (${d.prestacao_contas.length})`,
    )
    const altCab = 20
    garantirEspaco(altCab + 20)
    retangulo(MARGEM, y, LARGURA_UTIL, altCab, [0.91, 0.94, 0.98], [0.82, 0.87, 0.93])
    escrever('PARC.', MARGEM + 6, y - 13, 7.2, true, [0.2, 0.28, 0.4])
    escrever('REPASSE', MARGEM + 42, y - 13, 7.2, true, [0.2, 0.28, 0.4])
    escrever('EXECUTADO', MARGEM + 128, y - 13, 7.2, true, [0.2, 0.28, 0.4])
    escrever('PROCESSO', MARGEM + 215, y - 13, 7.2, true, [0.2, 0.28, 0.4])
    escrever('SITUAÇÃO', MARGEM + 340, y - 13, 7.2, true, [0.2, 0.28, 0.4])
    y -= altCab

    d.prestacao_contas.forEach((p, idx) => {
      const altLinha = 18
      garantirEspaco(altLinha + 4)
      const bg: [number, number, number] = idx % 2 === 0 ? [1, 1, 1] : [0.97, 0.98, 1.0]
      retangulo(MARGEM, y, LARGURA_UTIL, altLinha, bg, [0.9, 0.92, 0.96])
      escrever(p.parcela !== null && p.parcela !== undefined ? `${p.parcela}ª` : AUSENTE, MARGEM + 6, y - 12, 8, true)
      escrever(moeda(p.valor_repasse), MARGEM + 42, y - 12, 8)
      escrever(moeda(p.valor_executado), MARGEM + 128, y - 12, 8)
      escrever((p.processo ?? AUSENTE).slice(0, 22), MARGEM + 215, y - 12, 7.8)
      escrever((p.situacao ?? AUSENTE).slice(0, 32), MARGEM + 340, y - 12, 7.8)
      y -= altLinha
    })
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
  // Objetos: 1=Catalog, 2=Pages, 3=Font Helvetica, 4=Font Helvetica-Bold, 5..=Page+Contents
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

export function baixarRelatorioPdfConvenio(d: DetalheConvenio): void {
  const bytes = gerarPdfConvenio(d)
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

export async function exportarPdfPorChave(
  numero: string,
  municipio: string,
  mes?: MesConsulta,
): Promise<void> {
  const detalhe = await apiGet<DetalheConvenio>('/painel/convenio', {
    numero,
    municipio,
    ano: mes?.ano,
    mes: mes?.mes,
  })
  baixarRelatorioPdfConvenio(detalhe)
}
