import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom não tem ResizeObserver (usado pelos gráficos).
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverFalso as unknown as typeof ResizeObserver


// O Leaflet não roda no jsdom: nas telas, o mapa de municípios vira um dublê com a mesma lógica (src/teste/MapaFalso.tsx).
vi.mock('../mapa/MapaMunicipios', () => import('./MapaFalso'))
