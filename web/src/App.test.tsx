import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { ehContagem, erro, ok, rotasPadrao, stubApi, type Rotas } from './teste/api'
import * as f from './teste/fixtures'
import { renderizar, urlAtual } from './teste/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

const saldos = () => screen.findByRole('region', { name: 'Saldos SIAFE' })

describe('navegação', () => {
  it('abre a tela pelo endereço e marca o item do menu', async () => {
    stubApi(await rotasPadrao())
    renderizar(<App />, '/municipios')
    expect(await screen.findByRole('heading', { name: /Municípios/ })).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Telas' })
    expect(within(menu).getByRole('link', { name: 'Municípios' })).toHaveAttribute('aria-current', 'page')
  })

  it('endereço desconhecido mostra "não encontrado" com link para a Visão geral', async () => {
    stubApi(await rotasPadrao())
    renderizar(<App />, '/nao-existe')
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para a Visão geral' })).toHaveAttribute('href', '/')
  })

  it.each(['/', '/municipios', '/convenios', '/convenio?numero=901%2F2020&municipio=Paraty', '/cargas', '/nao-existe'])(
    'faixa de sistema em desenvolvimento no topo de %s',
    async (endereco) => {
      stubApi(await rotasPadrao())
      renderizar(<App />, endereco)
      expect(screen.getByRole('note')).toHaveTextContent('Em desenvolvimento (passível de bugs e/ou erros inesperados)')
    },
  )

  it('trocar de tela pelo menu mantém os filtros', async () => {
    const api = stubApi(await rotasPadrao())
    renderizar(<App />, '/municipios?recorte=342&municipio=Paraty')
    await screen.findByRole('heading', { name: /Municípios/ })
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Telas' })).getByRole('link', { name: 'Convênios' }))
    await waitFor(() => expect(api.para('/painel/convenios')).toHaveLength(1))
    const pedido = api.para('/painel/convenios')[0]
    expect(pedido.params.get('recorte')).toBe('342')
    expect(pedido.params.getAll('municipio')).toEqual(['Paraty'])
    expect(urlAtual().pathname).toBe('/convenios')
  })

  it('no detalhe, o menu não leva o município da chave como filtro', async () => {
    stubApi(await rotasPadrao())
    renderizar(<App />, '/convenio?numero=901%2F2020&municipio=Paraty')
    await screen.findByRole('heading', { name: /Convênio 901\/2020/ })
    const link = within(screen.getByRole('navigation', { name: 'Telas' })).getByRole('link', { name: 'Convênios' })
    expect(link).toHaveAttribute('href', '/convenios')
  })
})

describe('barra de filtros', () => {
  it('recarregar mantém os filtros: os pedidos usam os da URL', async () => {
    const api = stubApi(await rotasPadrao())
    renderizar(<App />, '/convenios?recorte=89&municipio=Paraty')
    await saldos()
    const pedidos = api.para('/painel/resumo').filter((p) => p.params.get('recorte') === '89' && !ehContagem(p))
    expect(pedidos[0].params.getAll('municipio')).toEqual(['Paraty'])
    expect(screen.getByRole('button', { name: /^Primeiro realinhamento/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Paraty', { selector: 'span' })).toBeInTheDocument()
  })

  it('as opções de municípios seguem o recorte', async () => {
    const api = stubApi(await rotasPadrao())
    renderizar(<App />, '/convenios?recorte=342')
    await userEvent.click(screen.getByRole('button', { name: /^Municípios/ }))
    const lista = await screen.findByRole('list', { name: 'Municípios do recorte' })
    expect(within(lista).getByRole('checkbox', { name: 'Angra dos Reis' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Vigentes/ }))
    // Clicar fora fecha o popover; ao reabrir, a lista já é a do novo recorte.
    await userEvent.click(screen.getByRole('button', { name: /^Municípios/ }))
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Municípios do recorte' })).getByRole('checkbox', { name: 'Niterói' }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByRole('checkbox', { name: 'Angra dos Reis' })).not.toBeInTheDocument()
    const opcoes = api.para('/painel/municipios').filter((p) => p.params.get('tamanho') === '100')
    expect(opcoes.map((p) => p.params.get('recorte'))).toEqual(['342', '31'])
    expect(opcoes.every((p) => !p.params.has('municipio'))).toBe(true)
  })

  it('escolher município põe o filtro na URL', async () => {
    stubApi(await rotasPadrao())
    renderizar(<App />, '/convenios')
    await userEvent.click(screen.getByRole('button', { name: /^Municípios/ }))
    await userEvent.click(await screen.findByLabelText('Paraty'))
    expect(urlAtual().searchParams.getAll('municipio')).toEqual(['Paraty'])
    await userEvent.click(screen.getByRole('button', { name: 'Remover Paraty' }))
    expect(urlAtual().searchParams.has('municipio')).toBe(false)
  })

  it('Esc fecha a lista de municípios, e "Limpar municípios" tira todos do filtro', async () => {
    stubApi(await rotasPadrao())
    renderizar(<App />, '/convenios?municipio=Paraty&municipio=Niterói')
    const botao = screen.getByRole('button', { name: /^Municípios/ })
    expect(botao).toHaveTextContent('2 selecionados')
    await userEvent.click(botao)
    expect(await screen.findByRole('list', { name: 'Municípios do recorte' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('list', { name: 'Municípios do recorte' })).not.toBeInTheDocument()
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Limpar municípios' }))
    expect(urlAtual().searchParams.has('municipio')).toBe(false)
  })

  it('recorte inválido na URL mostra a mensagem e "limpar filtros", sem consultar a API', async () => {
    const api = stubApi(await rotasPadrao())
    renderizar(<App />, '/convenios?recorte=50')
    expect(screen.getByText(/recorte "50" não existe/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(urlAtual().search).toBe('')
    await waitFor(() => expect(api.para('/painel/convenios')).toHaveLength(1))
  })

  it('município recusado pela API (422) mostra o motivo e "limpar filtros"', async () => {
    const rotas = await rotasPadrao()
    stubApi({
      ...rotas,
      'GET /painel/convenios': () => erro(422, { msg: 'Município não reconhecido', municipios_invalidos: ['Atlantida'] }),
    })
    renderizar(<App />, '/convenios?municipio=Atlantida')
    expect(await screen.findByText('Município não reconhecido: Atlantida')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(urlAtual().searchParams.has('municipio')).toBe(false)
  })

  it('mostra o mês em uso e permite voltar ao último disponível', async () => {
    stubApi(await rotasPadrao())
    renderizar(<App />, '/convenios?ano=2025&mes=3')
    expect(await screen.findByLabelText('Mês de referência')).toHaveValue('2025-03')
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao último mês' }))
    expect(urlAtual().searchParams.has('ano')).toBe(false)
    await waitFor(() => expect(screen.getByLabelText('Mês de referência')).toHaveValue('2026-10'))
    expect(screen.getByText('último disponível')).toBeInTheDocument()
  })
})

describe('menu lateral', () => {
  it('em tela estreita, o botão Menu abre a gaveta, e escolher uma tela a fecha', async () => {
    stubApi(await rotasPadrao())
    renderizar(<App />, '/convenios')
    const botao = screen.getByRole('button', { name: 'Menu' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('navigation', { name: 'Telas' })
    expect(document.getElementById(botao.getAttribute('aria-controls') ?? '')).toContainElement(menu)
    await userEvent.click(within(menu).getByRole('link', { name: 'Convênios' }))
    expect(urlAtual().pathname).toBe('/convenios')
    expect(botao).toHaveAttribute('aria-expanded', 'false')
  })

  it('Esc fecha a gaveta', async () => {
    stubApi(await rotasPadrao())
    renderizar(<App />, '/convenios')
    const botao = screen.getByRole('button', { name: 'Menu' })
    await userEvent.click(botao)
    await userEvent.keyboard('{Escape}')
    expect(botao).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('nomes dos recortes', () => {
  const contagens: Record<string, number> = { '342': 342, '89': 89, '31': 31 }
  const rotasComContagem = async (): Promise<Rotas> => ({
    ...(await rotasPadrao()),
    'GET /painel/resumo': (p) => {
      const recorte = (p.params.get('recorte') ?? '31') as '31' | '89' | '342'
      return ok(f.resumo({ recorte, convenios: ehContagem(p) ? contagens[recorte] : 5 }))
    },
  })
  const botoesRecorte = () => within(screen.getByRole('group', { name: 'Recorte' })).getAllByRole('button')

  it('mostra nome e contagem da API, do maior para o menor', async () => {
    stubApi(await rotasComContagem())
    renderizar(<App />, '/convenios')
    await waitFor(() =>
      expect(botoesRecorte().map((b) => b.getAttribute('aria-label'))).toEqual([
        'Histórico inicial (342 convênios)',
        'Primeiro realinhamento (89 convênios)',
        'Vigentes (31 convênios)',
      ]),
    )
    expect(screen.getByRole('button', { name: /^Vigentes/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a contagem segue a API, não o código', async () => {
    contagens['89'] = 92
    try {
      stubApi(await rotasComContagem())
      renderizar(<App />, '/convenios')
      expect(await screen.findByRole('button', { name: 'Primeiro realinhamento (92 convênios)' })).toBeInTheDocument()
    } finally {
      contagens['89'] = 89
    }
  })

  it('a contagem é do recorte inteiro, mesmo com município selecionado', async () => {
    const api = stubApi(await rotasComContagem())
    renderizar(<App />, '/convenios?municipio=Paraty')
    expect(await screen.findByRole('button', { name: 'Vigentes (31 convênios)' })).toBeInTheDocument()
    await saldos()
    const contagem = api.para('/painel/resumo').filter(ehContagem)
    expect(contagem.map((p) => p.params.get('recorte')).sort()).toEqual(['31', '342', '89'])
  })

  it('um pedido de contagem por recorte; o 342 reaproveita o resumo geral do mês padrão', async () => {
    const api = stubApi(await rotasComContagem())
    renderizar(<App />, '/convenios')
    await screen.findByRole('button', { name: 'Vigentes (31 convênios)' })
    await saldos()
    const contagem = api.para('/painel/resumo').filter(ehContagem)
    expect(contagem.map((p) => p.params.get('recorte')).sort()).toEqual(['31', '342', '89'])
  })

  it('falha na contagem: só o nome, e o recorte continua escolhível', async () => {
    const rotas = await rotasComContagem()
    stubApi({
      ...rotas,
      'GET /painel/resumo': (p) =>
        ehContagem(p) && p.params.get('recorte') === '89' ? erro(500, 'falha') : rotas['GET /painel/resumo'](p),
    })
    renderizar(<App />, '/convenios')
    await screen.findByRole('button', { name: 'Vigentes (31 convênios)' })
    const botao = screen.getByRole('button', { name: 'Primeiro realinhamento' })
    await userEvent.click(botao)
    expect(urlAtual().searchParams.get('recorte')).toBe('89')
    expect(botao).toHaveAttribute('aria-pressed', 'true')
  })
})
