import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App'
import { erro, ok, rotasPadrao, stubApi, type Rotas } from '../teste/api'
import * as f from '../teste/fixtures'
import { renderizar, urlAtual } from '../teste/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function api(extra: Rotas = {}) {
  return stubApi({ ...(await rotasPadrao()), ...extra })
}

const cartao = (rotulo: string) => screen.getByLabelText(rotulo, { selector: 'div' })

describe('Visão geral', () => {
  it('recorte 31 sem filtro: saldos com variação, contratual, cobertura, série e datas', async () => {
    await api()
    renderizar(<App />, '/')
    await screen.findByText(/convênios · recorte/)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(cartao('A pagar')).toHaveTextContent('R$ 1.000,00')
    expect(within(cartao('A pagar')).getByTestId('variacao-a_pagar')).toHaveTextContent('+25,0%')
    // anterior nulo e anterior zero → "—"
    expect(within(cartao('A aprovar')).getByTestId('variacao-a_aprovar')).toHaveTextContent('—')
    expect(within(cartao('Aprovados')).getByTestId('variacao-aprovados')).toHaveTextContent('—')
    expect(screen.getByRole('region', { name: 'Valores contratuais' })).toHaveTextContent('45,5%')
    expect(screen.getByRole('region', { name: 'Cobertura do SIAFE' })).toHaveTextContent('50,0%')
    expect(screen.queryByRole('region', { name: 'Situação dos convênios' })).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Saldos SIAFE por mês' })).toBeInTheDocument()
    expect(screen.getByText(/Posição do SIAFE em 03\/11\/2026, 09:00/)).toHaveTextContent('planilha-sintetica.xlsx')
  })

  it('usa o último mês disponível quando a URL não traz mês', async () => {
    const corpo = f.resumo()
    corpo.referencia.ultimo_mes_disponivel = { ano: 2026, mes: 10 }
    const a = await api({ 'GET /painel/resumo': () => ok(corpo) })
    renderizar(<App />, '/')
    await screen.findByText(/convênios · recorte/)
    const filtrados = a.para('/painel/resumo').filter((p) => p.params.get('recorte') === '31')
    expect(filtrados).toHaveLength(1)
    expect(filtrados[0].params.get('ano')).toBe('2026')
    expect(filtrados[0].params.get('mes')).toBe('10')
    expect(urlAtual().searchParams.has('mes')).toBe(false)
  })

  it('recorte 342: situação no lugar do contratual', async () => {
    await api()
    renderizar(<App />, '/?recorte=342')
    const situacao = await screen.findByRole('region', { name: 'Situação dos convênios' })
    expect(situacao).toHaveTextContent('EM EXECUÇÃO')
    expect(situacao).toHaveTextContent('Sem informação')
    expect(screen.queryByRole('region', { name: 'Valores contratuais' })).not.toBeInTheDocument()
  })

  it('com município: sem cobertura', async () => {
    await api({
      'GET /painel/resumo': (p) => {
        const r = f.resumo()
        if (p.params.has('municipio') && r.siafe) {
          r.municipios = p.params.getAll('municipio')
          r.siafe.cobertura = null
        }
        return ok(r)
      },
    })
    renderizar(<App />, '/?municipio=Paraty')
    await screen.findByText(/· Paraty ·/)
    expect(screen.queryByRole('region', { name: 'Cobertura do SIAFE' })).not.toBeInTheDocument()
  })

  it('mês sem dados: aviso com o último mês disponível e saldos "—"', async () => {
    await api({
      'GET /painel/resumo': (p) => {
        const r = f.resumo()
        if (p.params.get('mes') === '3') {
          r.siafe = null
          r.referencia.ano = 2023
          r.referencia.mes = 3
        }
        return ok(r)
      },
    })
    renderizar(<App />, '/?ano=2023&mes=3')
    expect(await screen.findByText(/O SIAFE não tem dados de mar\/2023/)).toHaveTextContent('Último mês disponível: out/2026')
    expect(cartao('A pagar')).toHaveTextContent('—')
  })

  it('API fora do ar: erro na área, menu e filtros continuam utilizáveis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    renderizar(<App />, '/')
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Não foi possível falar com a API')
    await userEvent.click(screen.getByRole('button', { name: /342 · todos/ }))
    expect(urlAtual().searchParams.get('recorte')).toBe('342')
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Telas' })).getByRole('link', { name: 'Cargas' }))
    expect(screen.getByRole('heading', { name: 'Cargas' })).toBeInTheDocument()
  })
})

describe('Municípios', () => {
  it('ordena pelo cabeçalho no servidor, nos dois sentidos', async () => {
    const a = await api()
    renderizar(<App />, '/municipios')
    await screen.findByText('2 municípios')
    await userEvent.click(screen.getByRole('button', { name: /A pagar/ }))
    await waitFor(() => expect(urlAtual().searchParams.get('ordem')).toBe('a_pagar'))
    await userEvent.click(screen.getByRole('button', { name: /A pagar/ }))
    await waitFor(() => expect(urlAtual().searchParams.get('ordem')).toBe('-a_pagar'))
    await waitFor(() => {
      const ordens = a
        .para('/painel/municipios')
        .filter((p) => p.params.get('tamanho') === '20')
        .map((p) => p.params.get('ordem'))
      expect(ordens).toEqual([null, 'a_pagar', '-a_pagar'])
    })
    expect(screen.getByRole('columnheader', { name: /A pagar/ })).toHaveAttribute('aria-sort', 'descending')
  })

  it('paginação: 83 municípios em 5 páginas, página na URL', async () => {
    const a = await api({
      'GET /painel/municipios': (p) =>
        ok(f.municipios([f.linhaMunicipio(`Paraty`)], { total: 83, pagina: Number(p.params.get('pagina') ?? 1) })),
    })
    renderizar(<App />, '/municipios')
    await screen.findByText('Página 1 de 5')
    expect(screen.getByText('83 municípios')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(urlAtual().searchParams.get('pagina')).toBe('2')
    await waitFor(() => expect(a.para('/painel/municipios').some((p) => p.params.get('pagina') === '2')).toBe(true))
  })

  it('marca o código compartilhado e explica', async () => {
    await api({
      'GET /painel/municipios': () =>
        ok(f.municipios([f.linhaMunicipio('Niterói', { codigo_compartilhado: true }), f.linhaMunicipio('Paraty')])),
    })
    renderizar(<App />, '/municipios')
    const linha = await screen.findByRole('row', { name: 'Ver convênios de Niterói' })
    expect(linha).toHaveTextContent('(código compartilhado)')
    expect(screen.getByRole('row', { name: 'Ver convênios de Paraty' })).not.toHaveTextContent('código compartilhado')
    expect(screen.getByText(/Código compartilhado: um código SIAFE/)).toBeInTheDocument()
  })

  it('clique na linha abre Convênios com o município, mesmo recorte e mês', async () => {
    const a = await api()
    renderizar(<App />, '/municipios?recorte=89&ano=2026&mes=5&ordem=a_pagar&pagina=2')
    await userEvent.click(await screen.findByRole('row', { name: 'Ver convênios de Niterói' }))
    expect(urlAtual().pathname).toBe('/convenios')
    expect(Object.fromEntries(urlAtual().searchParams)).toEqual({ recorte: '89', ano: '2026', mes: '5', municipio: 'Niterói' })
    await waitFor(() => expect(a.para('/painel/convenios')[0]?.params.getAll('municipio')).toEqual(['Niterói']))
  })

  it('recorte 342 não mostra colunas contratuais', async () => {
    await api()
    renderizar(<App />, '/municipios?recorte=342')
    await screen.findByText('3 municípios')
    expect(screen.queryByRole('columnheader', { name: /Valor total/ })).not.toBeInTheDocument()
  })
})

describe('Convênios', () => {
  it('nulo como "—" ao lado de zero; contratuais nos recortes 31/89', async () => {
    await api({
      'GET /painel/convenios': () =>
        ok(f.convenios([f.linhaConvenio('901/2020', 'Paraty', { a_pagar: 0, a_comprovar: null, codigo_seiop: null })])),
    })
    renderizar(<App />, '/convenios')
    const linha = await screen.findByRole('row', { name: /901\/2020 de Paraty/ })
    const celulas = within(linha).getAllByRole('cell')
    const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent?.replace(/[▲▼]/g, '').trim())
    expect(celulas[cabecalhos.indexOf('A pagar')]).toHaveTextContent('R$ 0,00')
    expect(celulas[cabecalhos.indexOf('A comprovar')]).toHaveTextContent('—')
    expect(celulas[cabecalhos.indexOf('SEIOP')]).toHaveTextContent('—')
    expect(celulas[cabecalhos.indexOf('Execução')]).toHaveTextContent('45,5%')
  })

  it('lista vazia', async () => {
    await api({ 'GET /painel/convenios': () => ok(f.convenios([])) })
    renderizar(<App />, '/convenios?municipio=Paraty')
    expect(await screen.findByText('Nenhum convênio neste filtro.')).toBeInTheDocument()
    expect(screen.getByText('0 convênios')).toBeInTheDocument()
  })

  it('clique na linha abre o detalhe pela chave, com o mês em uso', async () => {
    const a = await api({
      'GET /painel/convenios': () => ok(f.convenios([f.linhaConvenio('143/2014', 'Paraty')])),
    })
    renderizar(<App />, '/convenios?ano=2026&mes=5')
    await userEvent.click(await screen.findByRole('row', { name: /143\/2014 de Paraty/ }))
    expect(urlAtual().pathname).toBe('/convenio')
    expect(Object.fromEntries(urlAtual().searchParams)).toEqual({ numero: '143/2014', municipio: 'Paraty', ano: '2026', mes: '5' })
    await waitFor(() => expect(a.para('/painel/convenio')).toHaveLength(1))
    expect(Object.fromEntries(a.para('/painel/convenio')[0].params)).toEqual({
      numero: '143/2014',
      municipio: 'Paraty',
      ano: '2026',
      mes: '5',
    })
  })
})

describe('Detalhe do convênio', () => {
  const URL_DETALHE = '/convenio?numero=901%2F2020&municipio=Paraty'

  it('convênio vigente: identificação, saldos, blocos 31 e 89 e série', async () => {
    await api()
    renderizar(<App />, URL_DETALHE)
    expect(await screen.findByRole('heading', { name: 'Convênio 901/2020 · Paraty' })).toBeInTheDocument()
    const id = screen.getByRole('region', { name: 'Identificação' })
    expect(id).toHaveTextContent('Obra sintética de teste')
    expect(id).toHaveTextContent('30/06/2027')
    expect(id).toHaveTextContent('31, 89, 342')
    expect(screen.getByRole('region', { name: 'Valores contratuais · aba 31' })).toHaveTextContent('R$ 5.000,00')
    expect(screen.getByRole('region', { name: 'Valores contratuais · aba 89' })).toHaveTextContent('R$ 6.000,00')
    expect(screen.getByRole('region', { name: 'Saldos do mês' })).toHaveTextContent('A comprovar —')
    expect(screen.getByRole('region', { name: 'Saldos SIAFE do convênio por mês' })).toBeInTheDocument()
  })

  it('convênio só da 342: aviso de que não há valores contratuais', async () => {
    await api({ 'GET /painel/convenio': () => ok(f.detalhe({ recortes: ['342'], fase: 'historico', contratual: [] })) })
    renderizar(<App />, URL_DETALHE)
    expect(await screen.findByText(/Não há valores contratuais para este convênio/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Valores contratuais/ })).not.toBeInTheDocument()
  })

  it('404: não encontrado com link para a lista', async () => {
    await api({ 'GET /painel/convenio': () => erro(404, 'Nenhum convênio com essa chave') })
    renderizar(<App />, '/convenio?numero=999%2F1999&municipio=Paraty')
    expect(await screen.findByRole('heading', { name: 'Convênio não encontrado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para a lista de convênios' })).toHaveAttribute('href', '/convenios')
  })

  it('422: mostra o motivo da API', async () => {
    await api({
      'GET /painel/convenio': () => erro(422, { msg: 'Número de convênio inválido', numero: 'abc', motivo: 'numero_invalido' }),
    })
    renderizar(<App />, '/convenio?numero=abc&municipio=Paraty')
    expect(await screen.findByRole('alert')).toHaveTextContent('Número de convênio inválido: numero_invalido')
  })

  it('clique num convênio com código compartilhado abre o detalhe dele', async () => {
    const a = await api({
      'GET /painel/convenio': (p) =>
        ok(
          p.params.get('numero') === '901/2020'
            ? f.detalhe({
                codigo_compartilhado: true,
                compartilhado_com: [{ numero_convenio: '055/2019', municipio: 'Niterói', codigo: '000101' }],
              })
            : f.detalhe({ numero_convenio: '055/2019', municipio: 'Niterói' }),
        ),
    })
    renderizar(<App />, URL_DETALHE)
    await userEvent.click(await screen.findByRole('link', { name: '055/2019 · Niterói' }))
    expect(await screen.findByRole('heading', { name: 'Convênio 055/2019 · Niterói' })).toBeInTheDocument()
    expect(a.para('/painel/convenio').map((p) => p.params.get('numero'))).toEqual(['901/2020', '055/2019'])
  })
})
