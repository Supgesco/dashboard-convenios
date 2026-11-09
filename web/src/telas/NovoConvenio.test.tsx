import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App'
import { ok, rotasPadrao, stubApi } from '../teste/api'
import { renderizar } from '../teste/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TelaNovoConvenio', () => {
  it('cadastra um novo convênio com códigos SEOBRAS e SEIOP normalizados', async () => {
    const padrao = await rotasPadrao()
    stubApi({
      ...padrao,
      'POST /painel/convenios': () =>
        ok(
          {
            numero_convenio: '015/2026',
            municipio: 'São Fidélis',
            status: 'Em execução',
            fase: 'Vigente',
            codigo_seobras: '240010',
            codigo_seiop: '000109',
            codigo_compartilhado: false,
            a_pagar: 10000,
            a_comprovar: 5000,
            a_aprovar: 0,
            aprovados: 0,
            valor_total: 100000,
            repasse_estado: 80000,
            contrapartida: 20000,
            investido_estado: 40000,
            a_repassar: 40000,
            execucao_pct: 50,
            investido_sobre_total_pct: 40,
          }),
    })

    renderizar(<App />, '/convenios')

    const botaoAbrir = await screen.findByRole('button', { name: /Novo Convênio/i })
    await userEvent.click(botaoAbrir)

    expect(await screen.findByRole('heading', { name: 'Novo Convênio' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Fase/i)).not.toBeInTheDocument()

    const selectSituacao = screen.getByLabelText(/Situação/i) as HTMLSelectElement
    const opcoes = Array.from(selectSituacao.options).map((o) => o.value)
    expect(opcoes).toEqual(['vigente', 'não vigente', 'vencido', 'a vencer', 'sob realinhamento'])

    // Em "vigente" mostra Início de Vigência e Fim da Vigência
    expect(screen.getByLabelText(/Início de Vigência/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Fim da Vigência/i)).toBeInTheDocument()

    // Em "não vigente" não mostra campos de data
    await userEvent.selectOptions(selectSituacao, 'não vigente')
    expect(screen.queryByLabelText(/Início de Vigência/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Fim da Vigência/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Data de Vencimento/i)).not.toBeInTheDocument()

    // Em "vencido" e "a vencer" mostra Data de Vencimento
    await userEvent.selectOptions(selectSituacao, 'vencido')
    expect(screen.getByLabelText(/Data de Vencimento/i)).toBeInTheDocument()
    await userEvent.selectOptions(selectSituacao, 'a vencer')
    expect(screen.getByLabelText(/Data de Vencimento/i)).toBeInTheDocument()

    // Em "sob realinhamento" mostra opções 1°, 2° ou 3°
    await userEvent.selectOptions(selectSituacao, 'sob realinhamento')
    const selectRealinhamento = screen.getByLabelText(/Realinhamento \(1°, 2° ou 3°\)/i) as HTMLSelectElement
    expect(Array.from(selectRealinhamento.options).map((o) => o.value)).toEqual(['1°', '2°', '3°'])

    await userEvent.type(screen.getByLabelText(/Número do Convênio/i), '15/2026')
    await userEvent.type(screen.getByLabelText(/Município \*/i), 'São Fidélis')
    await userEvent.selectOptions(selectRealinhamento, '2°')
    await userEvent.type(screen.getByLabelText(/Código SIAFE — SEOBRAS/i), 'CV240010')
    await userEvent.type(screen.getByLabelText(/Código SIAFE — SEIOP/i), '109')

    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar Convênio' }))

    expect(await screen.findByText(/Convênio 015\/2026 \(São Fidélis\) cadastrado com sucesso!/i)).toBeInTheDocument()
  })
})
