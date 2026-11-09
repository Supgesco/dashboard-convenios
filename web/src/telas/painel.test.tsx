import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App'
import { ehContagem, erro, ok, rotasPadrao, stubApi, type Rotas } from '../teste/api'
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
  // Carteira sintética: 342 cadastrados em 83 municípios, 31 vigentes em 14.
  const rotasCarteira = async (extra: Rotas = {}) =>
    api({
      'GET /painel/resumo': (p) => {
        const recorte = (p.params.get('recorte') ?? '31') as '31' | '89' | '342'
        return ok(f.resumo({ recorte, convenios: { '342': 342, '89': 89, '31': 31 }[recorte] }))
      },
      'GET /painel/municipios': (p) =>
        ok(
          p.params.get('recorte') === '342'
            ? f.municipios([f.linhaMunicipio('Niterói', { convenios: 30 }), f.linhaMunicipio('Paraty', { convenios: 12 })], { total: 83 })
            : f.municipios([f.linhaMunicipio('Paraty', { convenios: 3 })], { total: 14 }),
        ),
      ...extra,
    })

  it('cards gerais com os números da API, sem a barra de filtros', async () => {
    await rotasCarteira()
    renderizar(<App />, '/')
    expect(await screen.findByLabelText('Cadastrados', { selector: 'div' })).toHaveTextContent('342')
    await waitFor(() => expect(cartao('Cadastrados')).toHaveTextContent('em 83 municípios'))
    expect(cartao('Vigentes')).toHaveTextContent('31')
    await waitFor(() => expect(cartao('Vigentes')).toHaveTextContent('em 14 municípios'))
    expect(cartao('Valor total conveniado')).toHaveTextContent('R$ 5.000,00')
    expect(cartao('Investido pelo Estado')).toHaveTextContent('R$ 1.820,00')
    expect(cartao('Investido pelo Estado')).toHaveTextContent('36,4%')
    expect(within(cartao('Investido pelo Estado')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '36')
    expect(cartao('A repassar')).toHaveTextContent('R$ 2.180,00')
    expect(screen.queryByRole('group', { name: 'Recorte' })).not.toBeInTheDocument()
    expect(screen.getByText(/Posição do SIAFE em 03\/11\/2026, 09:00/)).toHaveTextContent('planilha-sintetica.xlsx')
  })

  it('percentual do investido nulo: "—" e sem barra', async () => {
    await rotasCarteira({
      'GET /painel/resumo': (p) => {
        const recorte = (p.params.get('recorte') ?? '31') as '31' | '342'
        const r = f.resumo({ recorte })
        if (r.contratual) r.contratual = { ...r.contratual, investido_sobre_total_pct: null }
        return ok(r)
      },
    })
    renderizar(<App />, '/')
    const card = await screen.findByLabelText('Investido pelo Estado', { selector: 'div' })
    expect(card).toHaveTextContent('—')
    expect(within(card).queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('convênios por status dos cadastrados, com o grupo "Sem informação"', async () => {
    await rotasCarteira()
    renderizar(<App />, '/')
    const status = await screen.findByRole('region', { name: 'Convênios por status' })
    expect(within(status).getAllByRole('listitem').map((i) => i.textContent)).toEqual([
      'EM EXECUÇÃO777,8%',
      'Sem informação222,2%',
    ])
    expect(status).toHaveTextContent('9convênios')
  })

  it('convênios por status: os 5 maiores com fatia própria e o resto somado em "Outros"', async () => {
    const status = [
      { valor: 'A', convenios: 1 },
      { valor: 'B', convenios: 40 },
      { valor: 'C', convenios: 30 },
      { valor: null, convenios: 20 },
      { valor: 'D', convenios: 5 },
      { valor: 'E', convenios: 2 },
      { valor: 'F', convenios: 2 },
    ]
    await rotasCarteira({
      'GET /painel/resumo': (p) => {
        const recorte = (p.params.get('recorte') ?? '31') as '31' | '342'
        const r = f.resumo({ recorte })
        if (r.situacao) r.situacao = { ...r.situacao, status }
        return ok(r)
      },
    })
    renderizar(<App />, '/')
    const regiao = await screen.findByRole('region', { name: 'Convênios por status' })
    const itens = within(regiao).getAllByRole('listitem').map((i) => i.textContent)
    expect(itens).toEqual(['B4040,0%', 'C3030,0%', 'Sem informação2020,0%', 'D55,0%', 'E22,0%', 'Outros33,0%'])
    expect(regiao).toHaveTextContent('100convênios')
  })

  it('"Vigência não confirmada" não tem fatia própria: entra em "Outros" e o próximo status sobe para o top 5', async () => {
    const status = [
      { valor: 'Concluído', convenios: 50 },
      { valor: 'Vigência não confirmada', convenios: 20 },
      { valor: 'Vigente', convenios: 10 },
      { valor: 'Expirado', convenios: 8 },
      { valor: 'Em execução', convenios: 6 },
      { valor: 'Tomada de Contas', convenios: 4 },
      { valor: 'Rescindido', convenios: 2 },
    ]
    await rotasCarteira({
      'GET /painel/resumo': (p) => {
        const recorte = (p.params.get('recorte') ?? '31') as '31' | '342'
        const r = f.resumo({ recorte })
        if (r.situacao) r.situacao = { ...r.situacao, status }
        return ok(r)
      },
    })
    renderizar(<App />, '/')
    const regiao = await screen.findByRole('region', { name: 'Convênios por status' })
    const itens = within(regiao).getAllByRole('listitem').map((i) => i.textContent)
    expect(itens).toEqual([
      'Concluído5050,0%',
      'Vigente1010,0%',
      'Expirado88,0%',
      'Em execução66,0%',
      'Tomada de Contas44,0%',
      'Outros2222,0%',
    ])
    expect(regiao).not.toHaveTextContent('Vigência não confirmada')
    expect(regiao).toHaveTextContent('100convênios')
  })

  it('top 10 municípios pedido à API sobre os cadastrados, com a quantidade escrita', async () => {
    const a = await rotasCarteira()
    renderizar(<App />, '/')
    const top = await screen.findByRole('region', { name: 'Top 10 municípios' })
    expect(within(top).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['Niterói30', 'Paraty12'])
    const pedido = a.para('/painel/municipios').find((p) => p.params.get('tamanho') === '10')
    expect(Object.fromEntries(pedido?.params ?? [])).toEqual({ recorte: '342', tamanho: '10', ordem: '-convenios' })
  })

  it('lista dos vigentes por valor total decrescente; o clique abre o detalhe sem mês', async () => {
    const a = await rotasCarteira({
      'GET /painel/convenios': () => ok(f.convenios([f.linhaConvenio('143/2014', 'Paraty')])),
    })
    renderizar(<App />, '/')
    const linha = await screen.findByRole('row', { name: /143\/2014 de Paraty/ })
    const [pedido] = a.para('/painel/convenios')
    expect(Object.fromEntries(pedido.params)).toEqual({ recorte: '31', pagina: '1', tamanho: '20', ordem: '-valor_total' })
    await userEvent.click(linha)
    expect(urlAtual().pathname).toBe('/convenio')
    expect(Object.fromEntries(urlAtual().searchParams)).toEqual({ numero: '143/2014', municipio: 'Paraty' })
  })

  it('filtros na URL não mudam os pedidos', async () => {
    const a = await rotasCarteira()
    renderizar(<App />, '/?recorte=89&municipio=Paraty&ano=2025&mes=3')
    await screen.findByRole('region', { name: 'Top 10 municípios' })
    await screen.findByRole('region', { name: 'Convênios vigentes' })
    const daTela = a.pedidos.filter((p) => p.caminho.startsWith('/painel/'))
    expect(daTela.every((p) => !p.params.has('municipio') && !p.params.has('ano') && !p.params.has('mes'))).toBe(true)
    expect(a.para('/painel/convenios')[0].params.get('recorte')).toBe('31')
  })

  it('sem saldos SIAFE, cobertura nem gráfico mensal', async () => {
    const a = await rotasCarteira()
    renderizar(<App />, '/')
    await screen.findByRole('region', { name: 'Convênios vigentes' })
    for (const rotulo of ['A pagar', 'A comprovar', 'A aprovar', 'Aprovados']) {
      expect(screen.queryByLabelText(rotulo, { selector: 'div' })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: 'Cobertura do SIAFE' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Saldos SIAFE por mês' })).not.toBeInTheDocument()
    expect(a.para('/painel/serie')).toHaveLength(0)
  })

  it('falha só na lista dos vigentes: o resto continua visível', async () => {
    await rotasCarteira({ 'GET /painel/convenios': () => erro(500, 'falhou') })
    renderizar(<App />, '/')
    expect(await screen.findByText('Não foi possível carregar os vigentes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument()
    expect(cartao('Cadastrados')).toHaveTextContent('342')
    expect(screen.getByRole('region', { name: 'Convênios por status' })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Top 10 municípios' })).toBeInTheDocument()
  })

  it('passar pela Visão geral mantém os filtros das outras telas', async () => {
    await api()
    renderizar(<App />, '/convenios?recorte=89&municipio=Paraty')
    await screen.findByRole('group', { name: 'Recorte' })
    const menu = () => screen.getByRole('navigation', { name: 'Telas' })
    await userEvent.click(within(menu()).getByRole('link', { name: 'Visão geral' }))
    await screen.findByLabelText('Cadastrados', { selector: 'div' })
    expect(screen.queryByRole('group', { name: 'Recorte' })).not.toBeInTheDocument()
    await userEvent.click(within(menu()).getByRole('link', { name: 'Convênios' }))
    expect(urlAtual().pathname).toBe('/convenios')
    expect(urlAtual().searchParams.get('recorte')).toBe('89')
    expect(urlAtual().searchParams.getAll('municipio')).toEqual(['Paraty'])
  })

  it('API fora do ar: erro na área, e o menu continua utilizável', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    renderizar(<App />, '/')
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Não foi possível falar com a API')
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

describe('Mapa de municípios', () => {
  // Recorte 31: Paraty 1, Niterói 2; recorte 342: de 1 a 40 convênios (muitas quantidades).
  const rotasMapa = (extra: Rotas = {}) =>
    api({
      'GET /painel/municipios': (p) =>
        ok(
          p.params.get('recorte') === '342'
            ? f.municipios(
                ['Angra dos Reis', 'Niterói', 'Paraty', 'Maricá', 'Petrópolis', 'Resende', 'Volta Redonda'].map((m, i) =>
                  f.linhaMunicipio(m, { convenios: [1, 3, 6, 10, 18, 25, 40][i] }),
                ),
              )
            : f.municipios([f.linhaMunicipio('Paraty', { convenios: 1 }), f.linhaMunicipio('Niterói', { convenios: 2 })]),
        ),
      ...extra,
    })
  const mapa = () => screen.findByRole('list', { name: 'Mapa (dublê)' })
  const legenda = () => within(screen.getByRole('list', { name: 'Legenda do mapa' })).getAllByRole('listitem')
  const pedidosMapa = (a: Awaited<ReturnType<typeof api>>) =>
    a.para('/painel/municipios').filter((p) => p.params.get('tamanho') === '100')

  it('cores e legenda seguem o recorte; sem convênio fica cinza', async () => {
    await rotasMapa()
    renderizar(<App />, '/municipios')
    expect(await screen.findByRole('heading', { name: 'Convênios por município · Vigentes' })).toBeInTheDocument()
    await mapa()
    expect(legenda().map((i) => i.textContent)).toEqual(['Sem convênio', '1', '2'])
    const paraty = screen.getByRole('button', { name: 'Paraty · 1 convênio' })
    const niteroi = screen.getByRole('button', { name: 'Niterói · 2 convênios' })
    const marica = screen.getByRole('button', { name: 'Maricá · 0 convênios' })
    expect(paraty.dataset.cor).not.toBe(niteroi.dataset.cor)
    expect(marica.dataset.cor).toBe('#e2e8f0')

    await userEvent.click(screen.getByRole('button', { name: /^Histórico inicial/ }))
    expect(await screen.findByRole('heading', { name: 'Convênios por município · Histórico inicial' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Volta Redonda · 40 convênios' })).toBeInTheDocument())
    const faixas = legenda().slice(1)
    expect(faixas.length).toBeLessThanOrEqual(5)
    expect(faixas[0]).toHaveTextContent(/^1/)
    expect(faixas.at(-1)).toHaveTextContent(/40$/)
  })

  it('um único pedido por recorte, dividido com o seletor; trocar o mês não pede de novo', async () => {
    const a = await rotasMapa()
    renderizar(<App />, '/municipios?ano=2025&mes=3')
    await mapa()
    await userEvent.click(screen.getByRole('button', { name: /^Municípios/ }))
    await screen.findByRole('list', { name: 'Municípios do recorte' })
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao último mês' }))
    await waitFor(() =>
      expect(a.para('/painel/municipios').some((p) => p.params.get('tamanho') === '20' && p.params.get('ano') === '2026')).toBe(true),
    )
    expect(pedidosMapa(a)).toHaveLength(1)
    expect(pedidosMapa(a)[0].params.has('ano')).toBe(false)
  })

  it('com filtro de município, os demais ficam apagados', async () => {
    await rotasMapa()
    renderizar(<App />, '/municipios?municipio=Paraty')
    await mapa()
    expect(screen.getByRole('button', { name: 'Paraty · 1 convênio' }).dataset.apagado).toBe('false')
    expect(screen.getByRole('button', { name: 'Niterói · 2 convênios' }).dataset.apagado).toBe('true')
  })

  it('clique abre Convênios com o município, mesmo recorte e mês; sem convênio não navega', async () => {
    await rotasMapa({
      'GET /painel/municipios': () => ok(f.municipios([f.linhaMunicipio('Niterói', { convenios: 5 })])),
    })
    renderizar(<App />, '/municipios?recorte=89&ano=2026&mes=10')
    await mapa()
    await userEvent.click(screen.getByRole('button', { name: 'Maricá · 0 convênios' }))
    expect(urlAtual().pathname).toBe('/municipios')
    await userEvent.click(screen.getByRole('button', { name: 'Niterói · 5 convênios' }))
    expect(urlAtual().pathname).toBe('/convenios')
    expect(Object.fromEntries(urlAtual().searchParams)).toEqual({ recorte: '89', ano: '2026', mes: '10', municipio: 'Niterói' })
  })

  it('falha só no mapa: erro com "Tentar de novo", e a tabela continua', async () => {
    await rotasMapa({
      'GET /painel/municipios': (p) =>
        p.params.get('tamanho') === '100' ? erro(500, 'falha') : ok(f.municipios([f.linhaMunicipio('Paraty')])),
    })
    renderizar(<App />, '/municipios')
    expect(await screen.findByText('Não foi possível carregar o mapa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: 'Ver convênios de Paraty' })).toBeInTheDocument()
  })
})

describe('Convênios', () => {
  it('cards dos 4 saldos do filtro com variação por sinal e seta', async () => {
    const a = await api()
    renderizar(<App />, '/convenios?municipio=Paraty')
    expect(await screen.findByRole('region', { name: 'Saldos SIAFE' })).toBeInTheDocument()
    expect(cartao('A pagar')).toHaveTextContent('R$ 1.000,00')
    expect(within(cartao('A pagar')).getByTestId('variacao-a_pagar')).toHaveTextContent('+25,0%')
    expect(within(cartao('A pagar')).getByTestId('seta-a_pagar')).toHaveTextContent('▲')
    // anterior nulo e anterior zero → "—", sem seta
    expect(within(cartao('A aprovar')).getByTestId('variacao-a_aprovar')).toHaveTextContent('—')
    expect(within(cartao('Aprovados')).getByTestId('variacao-aprovados')).toHaveTextContent('—')
    expect(within(cartao('Aprovados')).queryByTestId('seta-aprovados')).not.toBeInTheDocument()
    const filtrados = a.para('/painel/resumo').filter((p) => !ehContagem(p))
    expect(filtrados.some((p) => p.params.get('recorte') === '31' && p.params.getAll('municipio').includes('Paraty'))).toBe(true)
  })

  it('usa o último mês disponível quando a URL não traz mês', async () => {
    const a = await api()
    renderizar(<App />, '/convenios')
    await screen.findByRole('region', { name: 'Saldos SIAFE' })
    const filtrados = a.para('/painel/resumo').filter((p) => p.params.get('recorte') === '31' && !ehContagem(p))
    expect(filtrados).toHaveLength(1)
    expect(filtrados[0].params.get('ano')).toBe('2026')
    expect(filtrados[0].params.get('mes')).toBe('10')
    expect(urlAtual().searchParams.has('mes')).toBe(false)
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
    renderizar(<App />, '/convenios?ano=2023&mes=3')
    expect(await screen.findByText(/O SIAFE não tem dados de mar\/2023/)).toHaveTextContent('Último mês disponível: out/2026')
    expect(cartao('A pagar')).toHaveTextContent('—')
  })

  it('falha do resumo aparece no lugar dos cards, e a lista continua', async () => {
    await api({
      'GET /painel/resumo': (p) => (ehContagem(p) ? ok(f.resumo({ recorte: (p.params.get('recorte') ?? '31') as '31' })) : erro(500, 'falhou')),
      'GET /painel/convenios': () => ok(f.convenios([f.linhaConvenio('901/2020', 'Paraty')])),
    })
    renderizar(<App />, '/convenios')
    expect(await screen.findByText('Não foi possível carregar os saldos')).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: /901\/2020 de Paraty/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument()
  })

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
    const recortes = within(within(id).getByRole('list', { name: 'Recortes' })).getAllByRole('listitem')
    expect(recortes.map((r) => r.textContent)).toEqual(['Histórico inicial', 'Primeiro realinhamento', 'Vigentes'])
    expect(screen.getByRole('region', { name: 'Valores contratuais · Vigentes' })).toHaveTextContent('R$ 5.000,00')
    expect(screen.getByRole('region', { name: 'Valores contratuais · Primeiro realinhamento' })).toHaveTextContent('R$ 6.000,00')
    const saldos = screen.getByRole('region', { name: 'Saldos do mês' })
    // Cada card mostra também o valor do mês anterior (out/2026 → set/2026); ausente vira "—".
    expect(within(saldos).getByLabelText('A pagar')).toHaveTextContent('Em set/2026: R$ 900,00')
    expect(within(saldos).getByLabelText('A comprovar')).toHaveTextContent('Em set/2026: —')
    expect(screen.getByRole('progressbar', { name: 'Execução de Valores contratuais · Vigentes' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Saldos SIAFE do convênio por mês' })).toBeInTheDocument()
  })

  it('convênio só da 342: aviso de que não há valores contratuais', async () => {
    await api({ 'GET /painel/convenio': () => ok(f.detalhe({ recortes: ['342'], fase: 'historico', contratual: [] })) })
    renderizar(<App />, URL_DETALHE)
    expect(await screen.findByText(/Não há valores contratuais para este convênio/)).not.toHaveTextContent(/aba/)
    expect(screen.queryByRole('region', { name: /Valores contratuais/ })).not.toBeInTheDocument()
  })

  it('404: não encontrado com link para a lista', async () => {
    await api({ 'GET /painel/convenio': () => erro(404, 'Nenhum convênio com essa chave') })
    renderizar(<App />, '/convenio?numero=999%2F1999&municipio=Paraty')
    expect(await screen.findByRole('heading', { name: 'Convênio não encontrado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para a lista de convênios' })).toHaveAttribute('href', '/convenios')
    expect(screen.getByText(/Não há convênio 999\/1999 em Paraty\./)).not.toHaveTextContent(/planilha/i)
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
