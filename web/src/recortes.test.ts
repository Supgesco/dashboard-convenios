import { describe, expect, it } from 'vitest'

import { nomesRecortes, ORDEM_EXIBICAO, rotuloRecorte } from './recortes'

describe('rotuloRecorte', () => {
  it('com número', () => {
    expect(rotuloRecorte('342', 342)).toBe('Histórico inicial (342 convênios)')
    expect(rotuloRecorte('89', 1234)).toBe('Primeiro realinhamento (1.234 convênios)')
  })

  it('singular', () => {
    expect(rotuloRecorte('31', 1)).toBe('Vigentes (1 convênio)')
  })

  it('sem número fica só o nome', () => {
    expect(rotuloRecorte('31')).toBe('Vigentes')
    expect(rotuloRecorte('31', null)).toBe('Vigentes')
  })

  it('zero é número, não ausência', () => {
    expect(rotuloRecorte('89', 0)).toBe('Primeiro realinhamento (0 convênios)')
  })
})

describe('ordem e nomes', () => {
  it('do maior para o menor', () => {
    expect(ORDEM_EXIBICAO).toEqual(['342', '89', '31'])
  })

  it('recortes do convênio pelo nome, na ordem de exibição', () => {
    expect(nomesRecortes(['31', '89', '342'])).toBe('Histórico inicial, Primeiro realinhamento, Vigentes')
    expect(nomesRecortes(['342'])).toBe('Histórico inicial')
  })
})
