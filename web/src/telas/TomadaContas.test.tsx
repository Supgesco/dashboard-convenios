import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ok, stubApi } from '../teste/api'
import { renderizar } from '../teste/render'
import { TelaTomadaContas } from './TomadaContas'

describe('TelaTomadaContas', () => {
  it('mostra os processos e métricas de tomada de contas', async () => {
    stubApi({
      'GET /painel/tomada-contas': () =>
        ok({
          municipios: ['Aperibé'],
          pagina: 1,
          tamanho: 20,
          total: 1,
          itens: [
            {
              id: 1,
              municipio: 'Aperibé',
              numero_convenio: '143/2014',
              codigo_seobras: '007783',
              valor_siafe: 125000.5,
              objeto: 'Reforma de praça pública',
              parecer_comissao: 'Parecer favorável à instauração',
              processo_sei: 'SEI-170001/000123/2024',
              status: 'Instaurado',
            },
          ],
        }),
    })

    renderizar(<TelaTomadaContas />, '/tomada-de-contas')

    expect(await screen.findByRole('heading', { name: /Tomada de Contas Especial/i })).toBeInTheDocument()
    expect(await screen.findByText('Aperibé')).toBeInTheDocument()
    expect(screen.getByText('143/2014')).toBeInTheDocument()
    expect(screen.getByText('007783')).toBeInTheDocument()
    expect(screen.getByText('Instaurado')).toBeInTheDocument()
    expect(screen.getByText('SEI-170001/000123/2024')).toBeInTheDocument()
  })
})
