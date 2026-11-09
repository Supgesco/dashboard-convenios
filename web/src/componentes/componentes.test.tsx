import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { inteiro, moeda } from '../formato'
import { describe, expect, it, vi } from 'vitest'

import { ApiErro } from '../api/cliente'
import { serie } from '../teste/fixtures'
import { BarrasHorizontais } from './BarrasHorizontais'
import { CaixaErro } from './Estados'
import { agruparTop } from '../rosca'
import { GraficoRosca } from './GraficoRosca'
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

  it('botão Editar em cada linha abre o modal, atualiza o item sem navegar e chama onSalvarEdicao', async () => {
    const onLinha = vi.fn()
    const onSalvarEdicao = vi.fn()
    render(
      <TabelaPaginada
        colunas={COLUNAS}
        itens={[{ nome: 'Município A', valor: 100 }]}
        chave={(i) => i.nome}
        total={1}
        pagina={1}
        tamanho={20}
        ordem={null}
        onOrdem={() => {}}
        onPagina={() => {}}
        onLinha={onLinha}
        onSalvarEdicao={onSalvarEdicao}
        unidade={['município', 'municípios']}
      />,
    )

    const botaoEditar = screen.getByRole('button', { name: 'Editar' })
    await userEvent.click(botaoEditar)
    expect(onLinha).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Editar registro')).toBeInTheDocument()

    const inputNome = within(dialog).getByLabelText('Nome')
    await userEvent.clear(inputNome)
    await userEvent.type(inputNome, 'Município Editado')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))

    expect(onSalvarEdicao).toHaveBeenCalledWith(
      { nome: 'Município A', valor: 100 },
      expect.objectContaining({ nome: 'Município Editado' }),
    )
    expect(screen.getByText('Município Editado')).toBeInTheDocument()
  })

  it('botão Remover exige confirmação de duas etapas antes de chamar onRemoverItem', async () => {
    const onRemoverItem = vi.fn().mockResolvedValue(undefined)
    render(
      <TabelaPaginada
        colunas={COLUNAS}
        itens={[{ nome: 'Convênio 999999', valor: 100 }]}
        chave={(i) => i.nome}
        total={1}
        pagina={1}
        tamanho={20}
        ordem={null}
        onOrdem={() => {}}
        onPagina={() => {}}
        onRemoverItem={onRemoverItem}
        unidade={['convênio', 'convênios']}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Remover' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Etapa 1 de 2')).toBeInTheDocument()
    expect(within(dialog).getByText('Remover convênio?')).toBeInTheDocument()
    expect(onRemoverItem).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar (1/2)' }))
    expect(within(dialog).getByText('Etapa 2 de 2')).toBeInTheDocument()
    expect(within(dialog).getByText('Confirmação final de exclusão')).toBeInTheDocument()
    expect(onRemoverItem).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar exclusão definitiva' }))
    expect(onRemoverItem).toHaveBeenCalledWith({ nome: 'Convênio 999999', valor: 100 })
    expect(screen.queryByText('Convênio 999999')).not.toBeInTheDocument()
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

describe('agruparTop', () => {
  const itens = (...v: [string | null, number][]) => v.map(([rotulo, valor]) => ({ rotulo, valor }))

  it('até n itens: sem "Outros", do maior para o menor, nulo como "Sem informação"', () => {
    const r = agruparTop(itens(['B', 1], [null, 3], ['A', 6]))
    expect(r.map((f) => [f.rotulo, f.valor, f.outros])).toEqual([
      ['A', 6, false],
      ['Sem informação', 3, false],
      ['B', 1, false],
    ])
    expect(r.map((f) => f.pct)).toEqual([60, 30, 10])
  })

  it('empate desempata pelo rótulo; o resto vira um "Outros" com a soma', () => {
    const r = agruparTop(itens(['Z', 5], ['A', 5], ['M', 4], ['X', 1], ['Y', 2]), 2)
    expect(r.map((f) => [f.rotulo, f.valor])).toEqual([
      ['A', 5],
      ['Z', 5],
      ['Outros', 7],
    ])
    expect(r.at(-1)?.outros).toBe(true)
  })

  it('cores fixas pela posição e "Outros" em cinza', () => {
    const r = agruparTop(itens(['a', 7], ['b', 6], ['c', 5], ['d', 4], ['e', 3], ['f', 2]))
    expect(new Set(r.map((f) => f.cor)).size).toBe(6)
    expect(r[5].cor).toBe('#94a3b8')
  })

  it('rótulos em semFatia vão para "Outros" mesmo sendo grandes, e o próximo sobe para o top', () => {
    const r = agruparTop(itens(['A', 9], ['N', 8], ['B', 3], ['C', 1]), 2, ['N'])
    expect(r.map((f) => [f.rotulo, f.valor])).toEqual([
      ['A', 9],
      ['B', 3],
      ['Outros', 9],
    ])
    expect(r.map((f) => f.pct)).toEqual([42.857142857142854, 14.285714285714285, 42.857142857142854])
    expect(agruparTop(itens(['A', 2], ['N', 1]), 5, ['N']).map((f) => [f.rotulo, f.valor])).toEqual([
      ['A', 2],
      ['Outros', 1],
    ])
  })

  it('lista vazia não tem fatias; total zero não tem percentual', () => {
    expect(agruparTop([])).toEqual([])
    expect(agruparTop(itens(['a', 0]))[0].pct).toBeNull()
  })
})

describe('GraficoRosca', () => {
  it('legenda com rótulo, quantidade e percentual e o total no centro', () => {
    render(<GraficoRosca titulo="Por status" itens={[{ rotulo: 'A', valor: 3 }, { rotulo: 'B', valor: 1 }]} />)
    const regiao = screen.getByRole('region', { name: 'Por status' })
    expect(within(regiao).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['A375,0%', 'B125,0%'])
    expect(regiao).toHaveTextContent('4convênios')
  })

  it('sem itens mostra a mensagem', () => {
    render(<GraficoRosca titulo="Por status" itens={[]} vazio="Nada." />)
    expect(screen.getByRole('region', { name: 'Por status' })).toHaveTextContent('Nada.')
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
