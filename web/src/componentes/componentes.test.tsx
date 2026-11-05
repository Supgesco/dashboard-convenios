import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { inteiro, moeda } from '../formato'
import { describe, expect, it, vi } from 'vitest'

import { ApiErro } from '../api/cliente'
import { serie } from '../teste/fixtures'
import { BarrasHorizontais } from './BarrasHorizontais'
import { CaixaErro } from './Estados'
import { GraficoSerie } from './GraficoSerie'
import { NumeroAnimado } from './NumeroAnimado'
import { BarraProgresso, Variacao } from '../telas/comum'
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

describe('Variacao', () => {
  it('sinal e seta para cima e para baixo; zero e ausente sem seta', () => {
    const { rerender } = render(<Variacao valor={12.5} campo="a_pagar" />)
    expect(screen.getByTestId('variacao-a_pagar')).toHaveTextContent('+12,5%')
    expect(screen.getByTestId('seta-a_pagar')).toHaveTextContent('▲')
    rerender(<Variacao valor={-12.5} campo="a_pagar" />)
    expect(screen.getByTestId('variacao-a_pagar')).toHaveTextContent('−12,5%')
    expect(screen.getByTestId('seta-a_pagar')).toHaveTextContent('▼')
    rerender(<Variacao valor={0} campo="a_pagar" />)
    expect(screen.queryByTestId('seta-a_pagar')).not.toBeInTheDocument()
    rerender(<Variacao valor={null} campo="a_pagar" />)
    expect(screen.getByTestId('variacao-a_pagar')).toHaveTextContent('—')
    expect(screen.queryByTestId('seta-a_pagar')).not.toBeInTheDocument()
  })
})

describe('BarraProgresso', () => {
  it('nulo não desenha barra', () => {
    const { container } = render(<BarraProgresso pct={null} rotulo="Execução" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('limita o valor ao intervalo 0–100', () => {
    render(
      <>
        <BarraProgresso pct={120} rotulo="Acima" />
        <BarraProgresso pct={-5} rotulo="Abaixo" />
        <BarraProgresso pct={45.5} rotulo="Meio" />
      </>,
    )
    expect(screen.getByRole('progressbar', { name: 'Acima' })).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByRole('progressbar', { name: 'Abaixo' })).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('progressbar', { name: 'Meio' })).toHaveAttribute('aria-valuenow', '46')
  })
})

describe('BarrasHorizontais', () => {
  it('mantém a ordem dada, escreve a quantidade e mede a barra pelo maior valor', () => {
    render(
      <BarrasHorizontais
        titulo="Por status"
        itens={[
          { rotulo: 'Concluído', valor: 200 },
          { rotulo: 'Em execução', valor: 50 },
          { rotulo: null, valor: 1200 },
        ]}
      />,
    )
    const regiao = screen.getByRole('region', { name: 'Por status' })
    const itens = within(regiao).getAllByRole('listitem')
    expect(itens.map((i) => i.textContent)).toEqual(['Concluído200', 'Em execução50', 'Sem informação1.200'])
    const barras = within(regiao).getAllByTestId('barra')
    expect(barras.map((b) => b.style.width)).toEqual([`${(200 / 1200) * 100}%`, `${(50 / 1200) * 100}%`, '100%'])
  })

  it('lista vazia mostra a mensagem', () => {
    render(<BarrasHorizontais titulo="Top 10" itens={[]} vazio="Nenhum município." />)
    expect(screen.getByRole('region', { name: 'Top 10' })).toHaveTextContent('Nenhum município.')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})

describe('NumeroAnimado', () => {
  it('nos testes mostra o valor final; nulo é "—"', () => {
    const { rerender } = render(<NumeroAnimado valor={1234} formatar={inteiro} />)
    expect(screen.getByText('1.234')).toBeInTheDocument()
    rerender(<NumeroAnimado valor={1500.5} formatar={moeda} />)
    expect(screen.getByText('R$ 1.500,50')).toBeInTheDocument()
    rerender(<NumeroAnimado valor={null} formatar={moeda} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
