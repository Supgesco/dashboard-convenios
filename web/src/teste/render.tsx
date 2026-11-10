import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, useLocation } from 'react-router'

import { criarQueryClient } from '../api/hooks'
import { CHAVE_SESSAO, type Usuario } from '../autenticacao'
import { USUARIO_SESSAO } from './api'

/** Mostra a URL atual num elemento escondido, para os testes conferirem a navegação. */
function Local() {
  const l = useLocation()
  return <output data-testid="url" hidden>{`${l.pathname}${l.search}`}</output>
}

/**
 * `sessao`: usuário já logado (padrão, para as telas aparecerem de imediato) ou `null` para
 * deixar o app consultar `GET /auth/me` no stub, como no navegador.
 */
export function renderizar(
  elemento: ReactElement,
  url = '/',
  { sessao = USUARIO_SESSAO as Usuario | null }: { sessao?: Usuario | null } = {},
) {
  const queryClient = criarQueryClient()
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  })
  if (sessao) queryClient.setQueryData(CHAVE_SESSAO, sessao)
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[url]}>
          {elemento}
          <Local />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

export function urlAtual(): URL {
  const texto = document.querySelector('[data-testid="url"]')?.textContent ?? '/'
  return new URL(texto, 'http://teste')
}
