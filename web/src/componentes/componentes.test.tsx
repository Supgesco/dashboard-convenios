import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ApiErro } from '../api/cliente'
import { serie } from '../teste/fixtures'
import { CaixaErro } from './Estados'
import { GraficoSerie } from './GraficoSerie'
import { TabelaPaginada, proximaOrdem, type Coluna } from './TabelaPaginada'

interface Item {
  nome: string
  valor: number
}

const COLUNAS: Coluna<Item>[] = [
  { campo: 'nome', rotulo: 'Nome', valor: (i) => i.nome },
  { campo: 'a_pagar', rotulo: 'A pagar', ordenavel: true, numerica: true, valor: (i) => i.valor },
]

function TabelaControlada({ total, onOrdem }: { total: number; onOrdem: (o: string) => void }) {
  const [ordem, setOrdem] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  return (
    <TabelaPaginada
      colunas={COLUNAS}
      itens={[{ nome: 'a', valor: 1 }]}
      chave={(i) => i.nome}
      total={total}
      pagina={pagina}
      tamanho={20}
      ordem={ordem}
      onOrdem={(o) => {
        onOrdem(o)
        setOrdem(o)
      }}
      onPagina={setPagina}
      unidade={['município', 'municípios']}
    />
  )
}

describe('TabelaPaginada', () => {
  it('dois cliques no cabeçalho: crescente e depois decrescente', async () => {
    const onOrdem = vi.fn()
    render(<TabelaControlada total={1} onOrdem={onOrdem} />)
    const botao = screen.getByRole('button', { name: /A pagar/ })
    await userEvent.click(botao)
    expect(screen.getByRole('columnheader', { name: /A pagar/ })).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.click(botao)
    expect(onOrdem.mock.calls.map((c) => c[0])).toEqual(['a_pagar', '-a_pagar'])
    expect(screen.getByRole('columnheader', { name: /A pagar/ })).toHaveAttribute('aria-sort', 'descending')
    expect(screen.queryByRole('button', { name: 'Nome' })).not.toBeInTheDocument()
  })

  it('83 itens em páginas de 20 = 5 páginas', async () => {
    render(<TabelaControlada total={83} onOrdem={() => {}} />)
    expect(screen.getByText('83 municípios')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(screen.getByText('Página 5 de 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  })

  it('lista vazia', () => {
    render(
      <TabelaPaginada
        colunas={COLUNAS}
        itens={[]}
        chave={(i) => i.nome}
        total={0}
        pagina={1}
        tamanho={20}
        ordem={null}
        onOrdem={() => {}}
        onPagina={() => {}}
        unidade={['convênio', 'convênios']}
        vazio="Nenhum convênio neste filtro."
      />,
    )
    expect(screen.getByText('Nenhum convênio neste filtro.')).toBeInTheDocument()
    expect(screen.getByText('0 convênios')).toBeInTheDocument()
  })

  it('proximaOrdem', () => {
    expect(proximaOrdem(null, 'x')).toBe('x')
    expect(proximaOrdem('x', 'x')).toBe('-x')
    expect(proximaOrdem('-x', 'x')).toBe('x')
    expect(proximaOrdem('y', 'x')).toBe('x')
  })
})

describe('CaixaErro', () => {
  it('"tentar de novo" refaz a consulta', async () => {
    const tentar = vi.fn()
    render(<CaixaErro erro={new ApiErro(0, null)} onTentar={tentar} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível falar com a API')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(tentar).toHaveBeenCalledOnce()
  })

  it('422 oferece limpar filtros, não tentar de novo', () => {
    render(<CaixaErro erro={new ApiErro(422, 'x')} onTentar={() => {}} onLimpar={() => {}} />)
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  })
})

describe('GraficoSerie', () => {
  it('visão em tabela mostra nulo como "—"', async () => {
    render(<GraficoSerie titulo="Série" pontos={serie(3).pontos} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver tabela' }))
    const linhas = screen.getAllByRole('row')
    expect(linhas).toHaveLength(4)
    expect(linhas[2]).toHaveTextContent('fev/2026')
    expect(linhas[2]).toHaveTextContent('—')
    expect(linhas[1]).toHaveTextContent('R$ 30,00')
  })

  it('sem pontos', () => {
    render(<GraficoSerie titulo="Série" pontos={[]} />)
    expect(screen.getByText('Nenhum mês carregado.')).toBeInTheDocument()
  })
})
