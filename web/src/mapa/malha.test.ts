import { describe, expect, it } from 'vitest'

import { MUNICIPIOS_RJ } from '../teste/municipios-rj'
import { chave } from './logica'
import malha from './municipios-rj.json'

describe('malha dos municípios do RJ', () => {
  it('tem os 92 municípios, um por feição', () => {
    expect(malha.features).toHaveLength(92)
    expect(new Set(malha.features.map((f) => f.properties.codigo_ibge)).size).toBe(92)
  })

  it('os nomes casam com a lista oficial pela chave normalizada', () => {
    const daMalha = malha.features.map((f) => chave(f.properties.nome)).sort()
    const oficiais = MUNICIPIOS_RJ.map(chave).sort()
    expect(daMalha).toEqual(oficiais)
  })

  it('todos os códigos IBGE são do RJ (33)', () => {
    expect(malha.features.every((f) => /^33\d{5}$/.test(f.properties.codigo_ibge))).toBe(true)
  })
})
