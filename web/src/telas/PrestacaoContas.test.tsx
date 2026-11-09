import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ok, stubApi } from '../teste/api'
import { renderizar } from '../teste/render'
import { TelaPrestacaoContas } from './PrestacaoContas'

describe('TelaPrestacaoContas', () => {
  it('mostra as parcelas, repasses e execuções de prestação de contas', async () => {
    stubApi({
      'GET /painel/prestacao-contas': () =>
        ok({
          municipios: ['Aperibé'],
          pagina: 1,
          tamanho: 20,
          total: 1,
          itens: [
            {
              id: 1,
              item: 1,
              municipio: 'Aperibé',
              cnpj: '28.529.580/0001-00',
              numero_convenio: '143/2014',
              codigo_seobras: '007783',
              codigo_seiop: '210044',
              parcela: 1,
              valor_repasse: 50000.0,
              processo: 'E-17/001.335/2011',
              valor_executado: 48000.0,
              baixa_apresentacao: 'Sim',
              baixa_aprovacao: 'Sim',
              observacao: 'Primeira parcela concluída',
              situacao: '100% Executado',
            },
          ],
        }),
    })

    renderizar(<TelaPrestacaoContas />, '/prestacao-de-contas')

    expect(await screen.findByRole('heading', { name: /Prestação de Contas/i })).toBeInTheDocument()
    expect(await screen.findByText('Aperibé')).toBeInTheDocument()
    expect(screen.getByText('143/2014')).toBeInTheDocument()
    expect(screen.getByText('007783')).toBeInTheDocument()
    expect(screen.getByText('210044')).toBeInTheDocument()
    expect(screen.getByText('1ª')).toBeInTheDocument()
    expect(screen.getByText('100% Executado')).toBeInTheDocument()
  })
})
