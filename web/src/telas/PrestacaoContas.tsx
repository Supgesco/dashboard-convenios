import { useMemo } from 'react'
import { useEditarPrestacaoContas, usePrestacaoContas, useRemoverConvenio } from '../api/hooks'
import type { LinhaPrestacaoContas } from '../api/tipos'
import { Aviso, CaixaErro, Carregando } from '../componentes/Estados'
import { TabelaPaginada, type Coluna } from '../componentes/TabelaPaginada'
import { useFiltros } from '../filtros'
import { AUSENTE, moeda } from '../formato'

function badgeSituacao(sit: string | null) {
  if (!sit) return <span className="text-slate-400">{AUSENTE}</span>
  const s = sit.toLowerCase()
  if (s.includes('100%') || s.includes('aprovad') || s.includes('concl')) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        {sit}
      </span>
    )
  }
  if (s.includes('parcial') || s.includes('análise') || s.includes('analise')) {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
        {sit}
      </span>
    )
  }
  if (s.includes('pend') || s.includes('repassad') || s.includes('aguard')) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
        {sit}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/10">
      {sit}
    </span>
  )
}

const COLUNAS: Coluna<LinhaPrestacaoContas>[] = [
  {
    campo: 'municipio',
    rotulo: 'Município',
    ordenavel: true,
    fixa: true,
    valor: (i) => <span className="font-medium text-slate-900">{i.municipio}</span>,
  },
  {
    campo: 'numero_convenio',
    rotulo: 'Nº Convênio',
    ordenavel: true,
    valor: (i) => <span className="font-mono text-xs font-medium text-slate-800">{i.numero_convenio}</span>,
  },
  {
    campo: 'codigo_seobras',
    rotulo: 'SEOBRAS',
    valor: (i) => (i.codigo_seobras ? <span className="font-mono text-xs">{i.codigo_seobras}</span> : AUSENTE),
  },
  {
    campo: 'codigo_seiop',
    rotulo: 'SEIOP',
    valor: (i) => (i.codigo_seiop ? <span className="font-mono text-xs">{i.codigo_seiop}</span> : AUSENTE),
  },
  {
    campo: 'parcela',
    rotulo: 'Parcela',
    ordenavel: true,
    numerica: true,
    valor: (i) => (i.parcela ? `${i.parcela}ª` : AUSENTE),
  },
  {
    campo: 'valor_repasse',
    rotulo: 'Repasse (R$)',
    ordenavel: true,
    numerica: true,
    valor: (i) => <span className="font-medium text-slate-900">{moeda(i.valor_repasse)}</span>,
  },
  {
    campo: 'valor_executado',
    rotulo: 'Executado (R$)',
    ordenavel: true,
    numerica: true,
    valor: (i) => <span className="font-medium text-slate-700">{moeda(i.valor_executado)}</span>,
  },
  {
    campo: 'situacao',
    rotulo: 'Situação',
    valor: (i) => badgeSituacao(i.situacao),
  },
  {
    campo: 'baixa_apresentacao',
    rotulo: 'Baixa Apresentação',
    valor: (i) => (
      <span className="truncate text-xs text-slate-600" title={i.baixa_apresentacao ?? ''}>
        {i.baixa_apresentacao ?? AUSENTE}
      </span>
    ),
  },
  {
    campo: 'baixa_aprovacao',
    rotulo: 'Baixa Aprovação',
    valor: (i) => (
      <span className="truncate text-xs text-slate-600" title={i.baixa_aprovacao ?? ''}>
        {i.baixa_aprovacao ?? AUSENTE}
      </span>
    ),
  },
  {
    campo: 'processo',
    rotulo: 'Processo',
    valor: (i) => (i.processo ? <span className="font-mono text-xs">{i.processo}</span> : AUSENTE),
  },
  {
    campo: 'observacao',
    rotulo: 'Observação',
    valor: (i) => (
      <span className="line-clamp-2 max-w-xs text-xs text-slate-500" title={i.observacao ?? ''}>
        {i.observacao ?? AUSENTE}
      </span>
    ),
  },
]

export function TelaPrestacaoContas() {
  const { filtros, mudar, limpar } = useFiltros()
  const consulta = usePrestacaoContas(filtros.municipios, filtros)
  const editar = useEditarPrestacaoContas()
  const remover = useRemoverConvenio()
  const d = consulta.data

  const { totalRepasse, totalExecutado } = useMemo(() => {
    if (!d?.itens) return { totalRepasse: 0, totalExecutado: 0 }
    return {
      totalRepasse: d.itens.reduce((acc, cur) => acc + (cur.valor_repasse || 0), 0),
      totalExecutado: d.itens.reduce((acc, cur) => acc + (cur.valor_executado || 0), 0),
    }
  }, [d?.itens])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-tela">Prestação de Contas</h1>
        <p className="subtitulo-tela">
          Detalhamento de parcelas, valores repassados, notas fiscais, baixas e comprovações de convênios.
        </p>
      </header>

      {/* Cartões informativos de topo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="cartao flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Registros de Prestação</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{d ? d.total : '—'}</p>
          <p className="mt-1 text-xs text-slate-400">Total de parcelas e registros</p>
        </div>

        <div className="cartao flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Repassado (Página)</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {d ? moeda(totalRepasse) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Recursos transferidos</p>
        </div>

        <div className="cartao flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Executado (Página)</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-600">
            {d ? moeda(totalExecutado) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Comprovado pelos municípios</p>
        </div>
      </div>

      {consulta.isError ? (
        <CaixaErro erro={consulta.error} onTentar={() => void consulta.refetch()} onLimpar={limpar} />
      ) : !d ? (
        <Carregando texto="Carregando prestações de contas…" />
      ) : d.total === 0 ? (
        <Aviso>
          Nenhum registro de prestação de contas encontrado para os filtros selecionados.{' '}
          <button type="button" onClick={limpar} className="font-semibold underline hover:text-slate-900">
            Limpar filtros
          </button>
        </Aviso>
      ) : (
        <TabelaPaginada
          colunas={COLUNAS}
          itens={d.itens}
          chave={(i) => `${i.id}-${i.numero_convenio}-${i.parcela ?? 0}`}
          total={d.total}
          pagina={filtros.pagina}
          tamanho={d.tamanho}
          ordem={filtros.ordem}
          onOrdem={(ordem) => mudar({ ordem, pagina: 1 })}
          onPagina={(pagina) => mudar({ pagina })}
          unidade={['registro', 'registros']}
          onSalvarEdicao={(item, alt) => editar.mutateAsync({ ...alt, id: item.id })}
          onRemoverItem={(item) =>
            remover.mutateAsync({
              numero: item.numero_convenio,
              municipio: item.municipio,
              prestacao_id: item.id,
            })
          }
        />
      )}
    </div>
  )
}
