// Stub de fetch por rota para os testes: nenhuma chamada chega à API real.
import { vi } from 'vitest'

export interface Pedido {
  metodo: string
  caminho: string
  params: URLSearchParams
}

export type Resposta = { status?: number; corpo?: unknown } | Promise<{ status?: number; corpo?: unknown }>
export type Rotas = Record<string, (pedido: Pedido) => Resposta>

/** Usuário sintético da sessão padrão dos testes. */
export const USUARIO_SESSAO = {
  id: 1,
  email: 'teste@obras.rj.gov.br',
  nome: 'Usuária de Teste',
  cargo: null,
  orgao: null,
  perfil: 'analista',
} as const

/** `rotas` é indexado por "GET /painel/resumo". Rota sem handler responde 500 (e falha o teste que depender dela). */
export function stubApi(rotasDoTeste: Rotas) {
  // Toda tela fica atrás do login: há sessão por padrão, e o teste sobrescreve "GET /auth/me" se precisar.
  const rotas: Rotas = { 'GET /auth/me': () => ok(USUARIO_SESSAO), ...rotasDoTeste }
  const pedidos: Pedido[] = []
  const fetch = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://teste')
    const pedido: Pedido = {
      metodo: init?.method ?? 'GET',
      caminho: url.pathname.replace(/^\/api/, ''),
      params: url.searchParams,
    }
    pedidos.push(pedido)
    const handler = rotas[`${pedido.metodo} ${pedido.caminho}`]
    const { status = 200, corpo = null } = handler
      ? await handler(pedido)
      : { status: 500, corpo: { detail: `rota sem stub: ${pedido.metodo} ${pedido.caminho}` } }
    if (status === 204) return new Response(null, { status })
    return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetch)
  return {
    pedidos,
    fetch,
    /** Pedidos feitos a um caminho. */
    para: (caminho: string) => pedidos.filter((p) => p.caminho === caminho),
  }
}

/** Pedido de contagem de convênios por recorte (barra de filtros): resumo sem município e sem mês. */
export const ehContagem = (p: Pedido) =>
  p.caminho === '/painel/resumo' && !p.params.has('municipio') && !p.params.has('ano') && !p.params.has('mes')

export const ok = (corpo: unknown) => ({ status: 200, corpo })
export const erro = (status: number, detail: unknown) => ({ status, corpo: { detail } })

/** Rotas com respostas sintéticas padrão; cada teste sobrescreve só o que importa. */
export async function rotasPadrao(): Promise<Rotas> {
  const f = await import('./fixtures')
  return {
    'GET /painel/resumo': (p) => ok(f.resumo({ recorte: (p.params.get('recorte') ?? '31') as '31' | '89' | '342' })),
    'GET /painel/municipios': (p) =>
      ok(
        f.municipios(
          p.params.get('recorte') === '31'
            ? [f.linhaMunicipio('Niterói'), f.linhaMunicipio('Paraty')]
            : [f.linhaMunicipio('Angra dos Reis'), f.linhaMunicipio('Niterói'), f.linhaMunicipio('Paraty')],
        ),
      ),
    'GET /painel/convenios': () => ok(f.convenios([f.linhaConvenio('901/2020', 'Paraty')])),
    'GET /painel/convenio': () => ok(f.detalhe()),
    'GET /etl/siafe/status': () => ok(f.execucao(3)),
    'GET /etl/siafe/execucoes': () => ok(f.execucoes([f.execucao(3), f.execucao(2), f.execucao(1)])),
  }
}
