import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, useLocation } from 'react-router'

import { criarQueryClient } from '../api/hooks'

/** Mostra a URL atual num elemento escondido, para os testes conferirem a navegação. */
function Local() {
  const l = useLocation()
  return <output data-testid="url" hidden>{`${l.pathname}${l.search}`}</output>
}

export function renderizar(elemento: ReactElement, url = '/') {
  const queryClient = criarQueryClient()
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  })
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
