import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { COR_SEM, RAMPA } from './logica'
import { LegendaMapa } from './PainelMapa'

describe('legenda do mapa', () => {
  it('lista "Sem convênio" e cada faixa com o intervalo, a mais alta no passo mais escuro', () => {
    render(
      <LegendaMapa
        faixas={[
          { de: 1, ate: 1 },
          { de: 2, ate: 4 },
          { de: 5, ate: 12 },
        ]}
      />,
    )
    const itens = within(screen.getByRole('list', { name: 'Legenda do mapa' })).getAllByRole('listitem')
    expect(itens.map((i) => i.textContent)).toEqual(['Sem convênio', '1', '2 a 4', '5 a 12'])
    const cor = (i: HTMLElement) => (i.querySelector('[aria-hidden]') as HTMLElement).style.backgroundColor
    const hex = (c: string) => {
      const d = document.createElement('span')
      d.style.backgroundColor = c
      return d.style.backgroundColor
    }
    expect(cor(itens[0])).toBe(hex(COR_SEM))
    expect(cor(itens[3])).toBe(hex(RAMPA[4]))
  })

  it('sem faixas, só "Sem convênio"', () => {
    render(<LegendaMapa faixas={[]} />)
    expect(within(screen.getByRole('list', { name: 'Legenda do mapa' })).getAllByRole('listitem')).toHaveLength(1)
  })
})
