import { describe, expect, it } from 'vitest'

import { AUSENTE, calcularVariacao, data, dataHora, mesAno, moeda, moedaCurta, percentual, variacao } from './formato'

describe('moeda', () => {
  it('formata em reais pt-BR', () => {
    expect(moeda(1234.56)).toBe('R$ 1.234,56')
  })
  it('zero é zero, nulo é "—"', () => {
    expect(moeda(0)).toBe('R$ 0,00')
    expect(moeda(null)).toBe(AUSENTE)
    expect(moeda(undefined)).toBe(AUSENTE)
  })
  it('negativo', () => {
    expect(moeda(-10)).toBe('-R$ 10,00')
  })
  it('abreviada para eixos', () => {
    expect(moedaCurta(1_200_000)).toBe('R$ 1,2 mi')
    expect(moedaCurta(null)).toBe(AUSENTE)
  })
})

describe('percentual e variação', () => {
  it('uma casa decimal', () => {
    expect(percentual(45.5)).toBe('45,5%')
    expect(percentual(0)).toBe('0,0%')
    expect(percentual(null)).toBe(AUSENTE)
  })
  it('variação com sinal', () => {
    expect(variacao(3.21)).toBe('+3,2%')
    expect(variacao(-1)).toBe('−1,0%')
    expect(variacao(null)).toBe(AUSENTE)
  })
  it('calcularVariacao', () => {
    expect(calcularVariacao(110, 100)).toBeCloseTo(10)
    expect(calcularVariacao(90, -100)).toBeCloseTo(190)
    expect(calcularVariacao(100, 0)).toBeNull()
    expect(calcularVariacao(100, null)).toBeNull()
    expect(calcularVariacao(null, 100)).toBeNull()
  })
})

describe('datas', () => {
  it('dia civil não muda com o fuso', () => {
    expect(data('2026-01-01')).toBe('01/01/2026')
    expect(data(null)).toBe(AUSENTE)
  })
  it('instante em São Paulo', () => {
    expect(dataHora('2026-11-04T13:30:00Z')).toBe('04/11/2026, 10:30')
    expect(dataHora(null)).toBe(AUSENTE)
  })
  it('mês/ano', () => {
    expect(mesAno(2026, 11)).toBe('nov/2026')
  })
})
