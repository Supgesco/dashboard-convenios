import { describe, expect, it } from 'vitest'

import { gerarPdfConvenio, nomeArquivoPdfConvenio } from './relatorioPdf'
import * as f from './teste/fixtures'

describe('relatorioPdf', () => {
  it('gera um arquivo PDF 1.4 válido com identificação, processo celebração, saldos por mês e dados do município', () => {
    const d = f.detalhe({
      numero_convenio: '143/2014',
      municipio: 'Paraty',
      processo_celebracao: 'E-17/001/1114/2014',
    })
    const bytes = gerarPdfConvenio(d, {
      resumoMunicipio: f.linhaMunicipio('Paraty', { convenios: 2 }),
      conveniosMunicipio: [
        f.linhaConvenio('143/2014', 'Paraty'),
        f.linhaConvenio('901/2020', 'Paraty'),
      ],
    })
    const texto = new TextDecoder('latin1').decode(bytes)

    expect(texto.startsWith('%PDF-1.4')).toBe(true)
    expect(texto).toContain('143/2014')
    expect(texto).toContain('Paraty')
    expect(texto).toContain('E-17/001/1114/2014')
    expect(texto).toContain('000101')
    expect(texto).toContain('jan/2026')
    expect(texto).toContain('fev/2026')
    expect(texto).toContain('mar/2026')
    expect(texto).toContain('TOTAIS CONSOLIDADOS DE PARATY')
    expect(texto).toContain('901/2020')
    expect(texto.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('normaliza o nome do arquivo PDF do convênio', () => {
    expect(nomeArquivoPdfConvenio('143/2014', 'Angra dos Reis')).toBe(
      'relatorio-convenio-143-2014-angra-dos-reis.pdf',
    )
  })
})
