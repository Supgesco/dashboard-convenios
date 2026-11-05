import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiErro, apiGet, mensagemDoDetail, montarUrl } from './cliente'

afterEach(() => {
  vi.unstubAllGlobals()
})

function respostaJson(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('montarUrl', () => {
  it('repete o parâmetro de lista e ignora vazios', () => {
    const url = montarUrl('/painel/convenios', {
      recorte: '89',
      municipio: ['Paraty', 'Niterói'],
      ano: undefined,
      ordem: null,
      pagina: 2,
    })
    expect(url).toBe('/api/painel/convenios?recorte=89&municipio=Paraty&municipio=Niter%C3%B3i&pagina=2')
  })

  it('sem parâmetros não põe "?"', () => {
    expect(montarUrl('/etl/siafe/status')).toBe('/api/etl/siafe/status')
  })
})

describe('apiGet', () => {
  it('devolve o JSON em 2xx', async () => {
    const fetch = vi.fn().mockResolvedValue(respostaJson(200, { ok: true }))
    vi.stubGlobal('fetch', fetch)
    await expect(apiGet('/painel/serie', { recorte: '31' })).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith('/api/painel/serie?recorte=31', expect.objectContaining({ method: 'GET' }))
  })

  it('detail em texto vira a mensagem do erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(404, { detail: 'Nenhum convênio com essa chave' })))
    const erro = await apiGet('/painel/convenio').catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ApiErro)
    expect((erro as ApiErro).status).toBe(404)
    expect((erro as ApiErro).message).toBe('Nenhum convênio com essa chave')
  })

  it('detail em objeto {msg, ...} é mantido e resumido na mensagem', async () => {
    const detail = { msg: 'Município não reconhecido', municipios_invalidos: ['Atlantida'] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(422, { detail })))
    const erro = (await apiGet('/painel/resumo').catch((e: unknown) => e)) as ApiErro
    expect(erro.status).toBe(422)
    expect(erro.detail).toEqual(detail)
    expect(erro.message).toBe('Município não reconhecido: Atlantida')
  })

  it('falha de rede vira status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const erro = (await apiGet('/painel/resumo').catch((e: unknown) => e)) as ApiErro
    expect(erro).toBeInstanceOf(ApiErro)
    expect(erro.status).toBe(0)
    expect(erro.message).toMatch(/Não foi possível falar com a API/)
  })
})

describe('resposta que não veio da API', () => {
  it('HTML (outro serviço na porta do proxy) vira erro explícito', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Not Found</html>', { status: 404, headers: { 'Content-Type': 'text/html' } })),
    )
    const erro = (await apiGet('/painel/resumo').catch((e: unknown) => e)) as ApiErro
    expect(erro).toBeInstanceOf(ApiErro)
    expect(erro.foraDaApi).toBe(true)
    expect(erro.status).toBe(404)
    expect(erro.message).toMatch(/A resposta não veio da API do painel \(HTTP 404\)/)
  })

  it('mesmo com 200, sem JSON é erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } })))
    const erro = (await apiGet('/painel/serie').catch((e: unknown) => e)) as ApiErro
    expect(erro.foraDaApi).toBe(true)
  })
})

describe('mensagemDoDetail', () => {
  it('lista de validação do FastAPI', () => {
    const detail = [{ loc: ['query', 'numero'], msg: 'Field required', type: 'missing' }]
    expect(mensagemDoDetail(422, detail)).toBe('numero: Field required')
  })

  it('motivo do número inválido', () => {
    expect(mensagemDoDetail(422, { msg: 'Número de convênio inválido', numero: 'abc', motivo: 'formato' })).toBe(
      'Número de convênio inválido: formato',
    )
  })

  it('sem detail usa o status', () => {
    expect(mensagemDoDetail(500, null)).toBe('A API respondeu com erro 500.')
  })
})
