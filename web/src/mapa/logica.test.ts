import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  COR_SEM,
  RAMPA,
  chave,
  corDe,
  coresFaixas,
  faixas,
  juntar,
  linkMunicipio,
  rotuloFaixa,
  textoDica,
} from './logica'

const feicao = (nome: string) => ({ properties: { nome, codigo_ibge: '3300000' } })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('chave', () => {
  it('ignora acento, caixa, espaço e pontuação', () => {
    expect(chave('São João de Meriti')).toBe(chave('sao joao de meriti'))
    expect(chave('Varre-Sai')).toBe('varresai')
    expect(chave('Niterói')).toBe('niteroi')
  })
})

describe('juntar', () => {
  it('soma por município, com 0 para quem a API não traz', () => {
    const r = juntar([feicao('Niterói'), feicao('Paraty'), feicao('Maricá')], [
      { municipio: 'Niterói', convenios: 5 },
      { municipio: 'PARATY', convenios: 2 },
    ])
    expect(r.get(chave('Niterói'))).toBe(5)
    expect(r.get(chave('Paraty'))).toBe(2)
    expect(r.get(chave('Maricá'))).toBe(0)
  })

  it('linha sem município no mapa só gera aviso', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = juntar([feicao('Niterói')], [{ municipio: 'Atlântida', convenios: 3 }])
    expect(r.size).toBe(1)
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('Atlântida'))
  })
})

describe('faixas', () => {
  it('até 5 valores distintos: uma faixa por valor, sem o zero', () => {
    expect(faixas([0, 1, 2, 1, 0, 2])).toEqual([
      { de: 1, ate: 1 },
      { de: 2, ate: 2 },
    ])
  })

  it('de 1 a 40: no máximo 5 faixas contíguas, cobrindo tudo sem sobreposição', () => {
    const qs = Array.from({ length: 40 }, (_, i) => i + 1)
    const f = faixas(qs)
    expect(f.length).toBeLessThanOrEqual(5)
    expect(f[0].de).toBe(1)
    expect(f.at(-1)?.ate).toBe(40)
    for (let i = 1; i < f.length; i++) expect(f[i].de).toBe(f[i - 1].ate + 1)
    for (const x of f) expect(x.ate).toBeGreaterThanOrEqual(x.de)
  })

  it('só zeros: nenhuma faixa', () => {
    expect(faixas([0, 0, 0])).toEqual([])
  })

  it('valores repetidos não criam faixas vazias', () => {
    const qs = [...Array(30).fill(1), 2, 3, 4, 5, 6, 7, 40]
    const f = faixas(qs)
    for (const x of f) expect(qs.some((q) => q >= x.de && q <= x.ate)).toBe(true)
    expect(f[0]).toEqual({ de: 1, ate: 1 })
    expect(f.at(-1)?.ate).toBe(40)
  })

  it('rótulo: valor único ou intervalo', () => {
    expect(rotuloFaixa({ de: 3, ate: 3 })).toBe('3')
    expect(rotuloFaixa({ de: 3, ate: 10 })).toBe('3 a 10')
  })
})

describe('cores', () => {
  it('a faixa mais alta usa sempre o passo mais escuro', () => {
    for (const n of [1, 2, 3, 5]) {
      const f = Array.from({ length: n }, (_, i) => ({ de: i + 1, ate: i + 1 }))
      expect(coresFaixas(f).at(-1)).toBe(RAMPA.at(-1))
      expect(corDe(n, f)).toBe(RAMPA.at(-1))
    }
  })

  it('zero fica no cinza "Sem convênio"', () => {
    expect(corDe(0, [{ de: 1, ate: 1 }])).toBe(COR_SEM)
  })
})

describe('dica e link', () => {
  it('singular e plural', () => {
    expect(textoDica('Niterói', 5)).toBe('Niterói · 5 convênios')
    expect(textoDica('Paraty', 1)).toBe('Paraty · 1 convênio')
    expect(textoDica('Maricá', 0)).toBe('Maricá · 0 convênios')
  })

  it('o link mantém recorte e mês, troca o município e descarta página e ordem', () => {
    const busca = new URLSearchParams('recorte=89&ano=2026&mes=10&municipio=Paraty&pagina=3&ordem=-a_pagar')
    const url = new URL(linkMunicipio(busca, 'Niterói'), 'http://x')
    expect(url.pathname).toBe('/convenios')
    expect(url.searchParams.get('recorte')).toBe('89')
    expect(url.searchParams.get('ano')).toBe('2026')
    expect(url.searchParams.get('mes')).toBe('10')
    expect(url.searchParams.getAll('municipio')).toEqual(['Niterói'])
    expect(url.searchParams.has('pagina')).toBe(false)
    expect(url.searchParams.has('ordem')).toBe(false)
  })
})
