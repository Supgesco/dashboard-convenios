import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App'
import { erro, ok, rotasPadrao, stubApi, USUARIO_SESSAO, type Rotas } from '../teste/api'
import { renderizar, urlAtual } from '../teste/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

const SEM_SESSAO: Rotas = { 'GET /auth/me': () => erro(401, 'Sessão inválida ou expirada. Faça login novamente.') }

async function semSessao(extra: Rotas = {}) {
  return stubApi({ ...(await rotasPadrao()), ...SEM_SESSAO, ...extra })
}

async function entrar(usuario: string, senha: string) {
  await userEvent.type(await screen.findByLabelText(/E-mail institucional/i), usuario)
  await userEvent.type(screen.getByLabelText(/Senha de acesso/i), senha)
  await userEvent.click(screen.getByRole('button', { name: /Acessar Painel/i }))
}

describe('TelaLogin', () => {
  it('sem sessão, mostra o login com e-mail institucional e senha', async () => {
    await semSessao()
    renderizar(<App />, '/', { sessao: null })

    expect(await screen.findByRole('heading', { name: /Painel de Convênios/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/E-mail institucional/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Senha de acesso/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Acessar Painel/i })).toBeInTheDocument()
    expect(urlAtual().pathname).toBe('/login')
  })

  it('permite alternar visibilidade da senha', async () => {
    await semSessao()
    renderizar(<App />, '/login', { sessao: null })

    const campoSenha = (await screen.findByLabelText(/Senha de acesso/i)) as HTMLInputElement
    expect(campoSenha.type).toBe('password')
    await userEvent.click(screen.getByLabelText(/Exibir senha/i))
    expect(campoSenha.type).toBe('text')
    await userEvent.click(screen.getByLabelText(/Ocultar senha/i))
    expect(campoSenha.type).toBe('password')
  })

  it('login correto envia o e-mail institucional e volta ao endereço pedido', async () => {
    const api = await semSessao({ 'POST /auth/login': () => ok(USUARIO_SESSAO) })
    renderizar(<App />, '/convenios?recorte=89', { sessao: null })

    await entrar('fulano', 'Exemplo@123')

    await waitFor(() => expect(urlAtual().pathname).toBe('/convenios'))
    expect(urlAtual().searchParams.get('recorte')).toBe('89')
    const [, init] = api.fetch.mock.calls.find(([url]) => String(url).endsWith('/auth/login'))!
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'fulano@obras.rj.gov.br', senha: 'Exemplo@123' })
    expect(await screen.findByText(USUARIO_SESSAO.nome)).toBeInTheDocument()
  })

  it('credenciais erradas mostram o erro e continuam no login', async () => {
    await semSessao({ 'POST /auth/login': () => erro(401, 'E-mail ou senha inválidos.') })
    renderizar(<App />, '/login', { sessao: null })

    await entrar('fulano', 'errada!!')

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(urlAtual().pathname).toBe('/login')
  })

  it('conta bloqueada (429) avisa o bloqueio temporário', async () => {
    await semSessao({
      'POST /auth/login': () =>
        erro(429, 'Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em alguns minutos.'),
    })
    renderizar(<App />, '/login', { sessao: null })

    await entrar('fulano', 'Exemplo@123')

    expect(await screen.findByRole('alert')).toHaveTextContent(/bloqueada temporariamente/)
  })

  it('API fora do ar no login mostra erro de conexão', async () => {
    await semSessao({ 'POST /auth/login': () => erro(503, 'Banco de dados indisponível') })
    renderizar(<App />, '/login', { sessao: null })

    await entrar('fulano', 'Exemplo@123')

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível falar com o serviço de autenticação/)
  })
})

describe('sessão', () => {
  it('recarregar com sessão válida abre a tela sem pedir senha', async () => {
    const api = stubApi(await rotasPadrao())
    renderizar(<App />, '/cargas', { sessao: null })

    expect(await screen.findByText(USUARIO_SESSAO.nome)).toBeInTheDocument()
    expect(urlAtual().pathname).toBe('/cargas')
    expect(api.para('/auth/me')).toHaveLength(1)
  })

  it('um 401 numa tela (sessão expirada) leva ao login', async () => {
    await stubApi({ ...(await rotasPadrao()), 'GET /etl/siafe/status': () => erro(401, 'Sessão inválida') })
    renderizar(<App />, '/cargas')

    expect(await screen.findByRole('button', { name: /Acessar Painel/i })).toBeInTheDocument()
    expect(urlAtual().pathname).toBe('/login')
  })

  it('Sair encerra a sessão na API e volta ao login', async () => {
    const api = stubApi({ ...(await rotasPadrao()), 'POST /auth/logout': () => ({ status: 204 }) })
    renderizar(<App />, '/cargas')

    await userEvent.click((await screen.findAllByRole('button', { name: 'Sair do sistema' }))[0])

    expect(await screen.findByRole('button', { name: /Acessar Painel/i })).toBeInTheDocument()
    await waitFor(() => expect(api.para('/auth/logout')).toHaveLength(1))
    expect(urlAtual().pathname).toBe('/login')
  })
})
