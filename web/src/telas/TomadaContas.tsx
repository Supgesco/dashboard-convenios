import { useMemo } from 'react'
import { useEditarTomadaContas, useRemoverConvenio, useTomadaContas } from '../api/hooks'
import type { LinhaTomadaContas } from '../api/tipos'
import { Aviso, CaixaErro, Carregando } from '../componentes/Estados'
import { TabelaPaginada, type Coluna } from '../componentes/TabelaPaginada'
import { useFiltros } from '../filtros'
import { AUSENTE, moeda } from '../formato'

function badgeStatus(status: string | null) {
  if (!status) return <span className="text-slate-400">{AUSENTE}</span>
  const s = status.toLowerCase()
  if (s.includes('concl') || s.includes('encerr')) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        {status}
      </span>
    )
  }
  if (s.includes('instaur') || s.includes('tce') || s.includes('cge')) {
    return (
      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
        {status}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
      {status}
    </span>
  )
}

const COLUNAS: Coluna<LinhaTomadaContas>[] = [
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
    rotulo: 'Cód. SIAFEM/SEOBRAS',
    valor: (i) => (i.codigo_seobras ? <span className="font-mono text-xs">{i.codigo_seobras}</span> : AUSENTE),
  },
  {
    campo: 'valor_siafe',
    rotulo: 'Valor SIAFE',
    ordenavel: true,
    numerica: true,
    valor: (i) => <span className="font-medium">{moeda(i.valor_siafe)}</span>,
  },
  {
    campo: 'status',
    rotulo: 'Status do Processo',
    valor: (i) => badgeStatus(i.status),
  },
  {
    campo: 'parecer_comissao',
    rotulo: 'Parecer da Comissão',
    valor: (i) => (
      <span className="max-w-xs truncate text-xs text-slate-600" title={i.parecer_comissao ?? ''}>
        {i.parecer_comissao ?? AUSENTE}
      </span>
    ),
  },
  {
    campo: 'processo_sei',
    rotulo: 'Processo SEI',
    valor: (i) => (i.processo_sei ? <span className="font-mono text-xs">{i.processo_sei}</span> : AUSENTE),
  },
  {
    campo: 'objeto',
    rotulo: 'Objeto',
    valor: (i) => (
      <span className="line-clamp-2 max-w-sm text-xs text-slate-600" title={i.objeto ?? ''}>
        {i.objeto ?? AUSENTE}
      </span>
    ),
  },
]

export function TelaTomadaContas() {
  const { filtros, mudar, limpar } = useFiltros()
  const consulta = useTomadaContas(filtros.municipios, filtros)
  const editar = useEditarTomadaContas()
  const remover = useRemoverConvenio()
  const d = consulta.data

  const { totalValorSiafe, totalComParecer } = useMemo(() => {
    if (!d?.itens) return { totalValorSiafe: 0, totalComParecer: 0 }
    return {
      totalValorSiafe: d.itens.reduce((acc, cur) => acc + (cur.valor_siafe || 0), 0),
      totalComParecer: d.itens.filter((cur) => Boolean(cur.parecer_comissao)).length,
    }
  }, [d?.itens])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-tela">Tomada de Contas Especial</h1>
        <p className="subtitulo-tela">
          Acompanhamento dos processos de Tomada de Contas instaurados junto ao TCE-RJ e CGE referentes aos convênios estaduais.
        </p>
      </header>

      {/* Cartões informativos de topo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="cartao flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total de Processos</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{d ? d.total : '—'}</p>
          <p className="mt-1 text-xs text-slate-400">Processos registrados no banco</p>
        </div>

        <div className="cartao flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Valor Acumulado no SIAFE</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
            {d ? moeda(totalValorSiafe) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Soma da página atual</p>
        </div>

        <div className="cartao flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Pareceres Emitidos</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-600">
            {d ? `${totalComParecer} / ${d.itens.length}` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Comissões que já manifestaram parecer</p>
        </div>
      </div>

      {consulta.isError ? (
        <CaixaErro erro={consulta.error} onTentar={() => void consulta.refetch()} onLimpar={limpar} />
      ) : !d ? (
        <Carregando texto="Carregando processos de tomada de contas…" />
      ) : d.total === 0 ? (
        <Aviso>
          Nenhum processo de tomada de contas encontrado para os filtros selecionados.{' '}
          <button type="button" onClick={limpar} className="font-semibold underline hover:text-slate-900">
            Limpar filtros
          </button>
        </Aviso>
      ) : (
        <TabelaPaginada
          colunas={COLUNAS}
          itens={d.itens}
          chave={(i) => `${i.id}-${i.numero_convenio}`}
          total={d.total}
          pagina={filtros.pagina}
          tamanho={d.tamanho}
          ordem={filtros.ordem}
          onOrdem={(ordem) => mudar({ ordem, pagina: 1 })}
          onPagina={(pagina) => mudar({ pagina })}
          unidade={['processo', 'processos']}
          onSalvarEdicao={(item, alt) => editar.mutateAsync({ ...alt, id: item.id })}
          onRemoverItem={(item) =>
            remover.mutateAsync({
              numero: item.numero_convenio,
              municipio: item.municipio,
              tomada_id: item.id,
            })
          }
        />
      )}
    </div>
  )
}
