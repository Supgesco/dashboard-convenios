import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App'
import { INTERVALO_STATUS_MS } from '../api/hooks'
import type { ExecucaoStatus } from '../api/tipos'
import { erro, ok, rotasPadrao, stubApi, type Rotas } from '../teste/api'
import * as f from '../teste/fixtures'
import { renderizar } from '../teste/render'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function api(extra: Rotas = {}) {
  return stubApi({ ...(await rotasPadrao()), ...extra })
}

const ultima = () => screen.getByRole('region', { name: 'Carga SIAFE' })

describe('acompanhamento', () => {
  it('mostra a última carga, o histórico e a última importação da planilha, sem upload', async () => {
    await api()
    renderizar(<App />, '/cargas')
    expect(await within(ultima()).findByText('Sucesso')).toBeInTheDocument()
    expect(ultima()).toHaveTextContent('1.234')
    const historico = screen.getByRole('region', { name: 'Histórico de cargas' })
    expect(await within(historico).findByText('3 cargas')).toBeInTheDocument()
    expect(within(historico).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      '3',
      '2',
      '1',
    ])
    const planilha = screen.getByRole('region', { name: 'Planilha' })
    expect(await within(planilha).findByText('planilha-sintetica.xlsx')).toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it('em andamento: consulta o status a cada 5 s e para no sucesso, atualizando o histórico', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let atual: ExecucaoStatus = f.execucao(4, { status: 'em_andamento', fim: null, registros: null })
    const a = await api({ 'GET /etl/siafe/status': () => ok(atual) })
    renderizar(<App />, '/cargas')
    expect(await within(ultima()).findByText(/atualizando a cada 5 segundos/)).toBeInTheDocument()
    expect(a.para('/etl/siafe/status')).toHaveLength(1)
    const historicoAntes = a.para('/etl/siafe/execucoes').length

    await act(() => vi.advanceTimersByTimeAsync(INTERVALO_STATUS_MS))
    expect(a.para('/etl/siafe/status')).toHaveLength(2)

    atual = f.execucao(4)
    await act(() => vi.advanceTimersByTimeAsync(INTERVALO_STATUS_MS))
    expect(await within(ultima()).findByText('Sucesso')).toBeInTheDocument()
    expect(a.para('/etl/siafe/status')).toHaveLength(3)
    await waitFor(() => expect(a.para('/etl/siafe/execucoes').length).toBeGreaterThan(historicoAntes))

    await act(() => vi.advanceTimersByTimeAsync(INTERVALO_STATUS_MS * 3))
    expect(a.para('/etl/siafe/status')).toHaveLength(3)
  })

  it('falha: mostra o status e o texto do erro', async () => {
    await api({
      'GET /etl/siafe/status': () => ok(f.execucao(5, { status: 'falha', erro: 'SiafeAuthError: POST /auth respondeu 401' })),
    })
    renderizar(<App />, '/cargas')
    expect(await within(ultima()).findByText('Falha')).toBeInTheDocument()
    expect(ultima()).toHaveTextContent('Erro: SiafeAuthError: POST /auth respondeu 401')
  })

  it('nenhuma carga: o 404 do status vira mensagem, não erro', async () => {
    await api({
      'GET /etl/siafe/status': () => erro(404, 'Nenhuma carga encontrada'),
      'GET /etl/siafe/execucoes': () => ok(f.execucoes([])),
    })
    renderizar(<App />, '/cargas')
    expect(await screen.findByText('Nenhuma carga SIAFE foi feita até agora.')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma carga SIAFE registrada.')).toBeInTheDocument()
    expect(within(ultima()).queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('disparo', () => {
  it('confirmar envia exatamente um POST e passa a acompanhar a carga', async () => {
    let disparada = false
    const a = await api({
      'POST /etl/siafe': () => {
        disparada = true
        return { status: 202, corpo: { execucao_id: 9, status: 'em_andamento' } }
      },
      'GET /etl/siafe/status': () =>
        ok(disparada ? f.execucao(9, { status: 'em_andamento', fim: null }) : f.execucao(3)),
    })
    renderizar(<App />, '/cargas')
    await within(ultima()).findByText('Sucesso')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar carga SIAFE' }))
    const dialogo = screen.getByRole('dialog', { name: 'Iniciar a carga SIAFE?' })
    expect(dialogo).toHaveTextContent('faz login no SIAFE')
    expect(dialogo).toHaveTextContent('substitui todos os dados atuais')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Iniciar carga' }))
    expect(await within(ultima()).findByText('Em andamento')).toBeInTheDocument()
    expect(a.pedidos.filter((p) => p.metodo === 'POST')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Iniciar carga SIAFE' })).toBeDisabled()
  })

  it('cancelar não envia nenhum pedido de carga', async () => {
    const a = await api()
    renderizar(<App />, '/cargas')
    await within(ultima()).findByText('Sucesso')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar carga SIAFE' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(a.pedidos.filter((p) => p.metodo === 'POST')).toHaveLength(0)
  })

  it('409: informa que já há carga em andamento e acompanha', async () => {
    let conflito = false
    await api({
      'POST /etl/siafe': () => {
        conflito = true
        return { status: 409, corpo: { detail: 'Já existe uma carga SIAFE em andamento', execucao_id: 7 } }
      },
      'GET /etl/siafe/status': () => ok(conflito ? f.execucao(7, { status: 'em_andamento', fim: null }) : f.execucao(3)),
    })
    renderizar(<App />, '/cargas')
    await within(ultima()).findByText('Sucesso')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar carga SIAFE' }))
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar carga' }))
    expect(await screen.findByText(/Já existe uma carga SIAFE em andamento/)).toBeInTheDocument()
    expect(await within(ultima()).findByText('Em andamento')).toBeInTheDocument()
  })

  it('botão desabilitado enquanto há carga em andamento', async () => {
    await api({ 'GET /etl/siafe/status': () => ok(f.execucao(4, { status: 'em_andamento', fim: null })) })
    renderizar(<App />, '/cargas')
    await within(ultima()).findByText('Em andamento')
    expect(screen.getByRole('button', { name: 'Iniciar carga SIAFE' })).toBeDisabled()
  })

  it('sem disparo, nenhuma tela faz pedido que não seja GET e nada vai para o armazenamento', async () => {
    localStorage.clear()
    sessionStorage.clear()
    const a = await api()
    renderizar(<App />, '/')
    await screen.findByText(/convênios · recorte/)
    const menu = screen.getByRole('navigation', { name: 'Telas' })
    for (const tela of ['Municípios', 'Convênios', 'Cargas', 'Visão geral']) {
      await userEvent.click(within(menu).getByRole('link', { name: tela }))
    }
    await userEvent.click(within(menu).getByRole('link', { name: 'Convênios' }))
    await userEvent.click(await screen.findByRole('row', { name: /901\/2020 de Paraty/ }))
    await screen.findByRole('heading', { name: /Convênio 901\/2020/ })
    expect(a.pedidos.length).toBeGreaterThan(5)
    expect(a.pedidos.every((p) => p.metodo === 'GET')).toBe(true)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})

describe('API errada no proxy', () => {
  it('404 em HTML não é "nenhuma carga": mostra o erro de proxy', async () => {
    await api()
    const original = globalThis.fetch
    vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, init?: RequestInit) => {
      if (String(entrada).includes('/etl/siafe/status')) {
        return new Response('<html>Not Found</html>', { status: 404, headers: { 'Content-Type': 'text/html' } })
      }
      return original(entrada, init)
    })
    renderizar(<App />, '/cargas')
    expect(await within(ultima()).findByRole('alert')).toHaveTextContent('A resposta não veio da API do painel')
    expect(screen.queryByText('Nenhuma carga SIAFE foi feita até agora.')).not.toBeInTheDocument()
  })
})
