import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { criarQueryClient } from './api/hooks'
import { aplicarMudanca, buscaGlobal, lerFiltros, useMesReferencia } from './filtros'
import { ok, stubApi } from './teste/api'
import { resumo } from './teste/fixtures'

afterEach(() => {
  vi.unstubAllGlobals()
})

const p = (texto: string) => new URLSearchParams(texto)

describe('lerFiltros', () => {
  it('padrões sem parâmetros', () => {
    expect(lerFiltros(p(''))).toEqual({
      recorte: '31',
      municipios: [],
      mes: null,
      pagina: 1,
      ordem: null,
      erro: null,
    })
  })

  it('município repetido, mês, página e ordem', () => {
    const f = lerFiltros(p('recorte=89&municipio=Paraty&municipio=Niter%C3%B3i&ano=2026&mes=3&pagina=2&ordem=-a_pagar'))
    expect(f).toMatchObject({
      recorte: '89',
      municipios: ['Paraty', 'Niterói'],
      mes: { ano: 2026, mes: 3 },
      pagina: 2,
      ordem: '-a_pagar',
      erro: null,
    })
  })

  it('recorte inválido é erro, sem troca silenciosa', () => {
    expect(lerFiltros(p('recorte=50')).erro).toMatch(/recorte "50"/)
  })

  it('mês incompleto ou fora do intervalo é erro', () => {
    expect(lerFiltros(p('ano=2026')).erro).toMatch(/mês de referência/)
    expect(lerFiltros(p('ano=2026&mes=13')).erro).toMatch(/mês de referência/)
  })

  it('página inválida cai para 1', () => {
    expect(lerFiltros(p('pagina=0')).pagina).toBe(1)
    expect(lerFiltros(p('pagina=x')).pagina).toBe(1)
  })
})

describe('aplicarMudanca', () => {
  it('serializa municípios repetidos e omite o recorte padrão', () => {
    const r = aplicarMudanca(p('recorte=89'), { recorte: '31', municipios: ['Paraty', 'Niterói'] })
    expect(r.getAll('municipio')).toEqual(['Paraty', 'Niterói'])
    expect(r.has('recorte')).toBe(false)
  })

  it('trocar filtro ou ordem volta para a página 1', () => {
    const base = p('pagina=3&ordem=municipio')
    expect(aplicarMudanca(base, { recorte: '342' }).has('pagina')).toBe(false)
    expect(aplicarMudanca(base, { municipios: ['Paraty'] }).has('pagina')).toBe(false)
    expect(aplicarMudanca(base, { mes: { ano: 2026, mes: 1 } }).has('pagina')).toBe(false)
    expect(aplicarMudanca(base, { ordem: '-a_pagar' }).has('pagina')).toBe(false)
  })

  it('trocar só a página mantém os filtros', () => {
    const r = aplicarMudanca(p('recorte=89&ordem=municipio'), { pagina: 2 })
    expect(r.toString()).toBe('recorte=89&ordem=municipio&pagina=2')
    expect(aplicarMudanca(r, { pagina: 1 }).has('pagina')).toBe(false)
  })

  it('mês nulo remove ano e mes', () => {
    const r = aplicarMudanca(p('ano=2026&mes=3'), { mes: null })
    expect(r.toString()).toBe('')
  })
})

describe('buscaGlobal', () => {
  it('leva só recorte, municípios e mês', () => {
    expect(buscaGlobal(p('recorte=89&municipio=Paraty&ano=2026&mes=3&pagina=2&ordem=x'))).toBe(
      '?recorte=89&municipio=Paraty&ano=2026&mes=3',
    )
  })
  it('extra substitui o parâmetro', () => {
    expect(buscaGlobal(p('municipio=Paraty&municipio=Niter%C3%B3i'), { municipio: 'Paraty' })).toBe('?municipio=Paraty')
  })
})

describe('useMesReferencia', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={criarQueryClient()}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('sem mês na URL, espera o último mês disponível antes de liberar as consultas', async () => {
    let responder: (v: { status: number; corpo: unknown }) => void = () => {}
    stubApi({
      'GET /painel/resumo': () => new Promise((r) => (responder = r)),
    })
    const { result } = renderHook(() => useMesReferencia(null), { wrapper })
    expect(result.current.resolvido).toBe(false)

    const corpo = resumo()
    corpo.referencia.ultimo_mes_disponivel = { ano: 2026, mes: 9 }
    responder(ok(corpo))
    await waitFor(() => expect(result.current.resolvido).toBe(true))
    expect(result.current.mes).toEqual({ ano: 2026, mes: 9 })
    expect(result.current.daUrl).toBe(false)
  })

  it('sem mês disponível, deixa a API escolher', async () => {
    const corpo = resumo()
    corpo.referencia.ultimo_mes_disponivel = null
    stubApi({ 'GET /painel/resumo': () => ok(corpo) })
    const { result } = renderHook(() => useMesReferencia(null), { wrapper })
    await waitFor(() => expect(result.current.resolvido).toBe(true))
    expect(result.current.mes).toBeNull()
  })

  it('mês da URL vale de imediato', () => {
    stubApi({ 'GET /painel/resumo': () => new Promise(() => {}) })
    const { result } = renderHook(() => useMesReferencia({ ano: 2025, mes: 1 }), { wrapper })
    expect(result.current).toMatchObject({ mes: { ano: 2025, mes: 1 }, resolvido: true, daUrl: true })
  })
})
