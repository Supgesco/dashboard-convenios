import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { TAMANHO_PAGINA, useConvenios, useEditarConvenio, useRankingRecorte, useRemoverConvenio, useResumoRecorte } from '../api/hooks'
import type { LinhaConvenio } from '../api/tipos'
import { BarrasHorizontais } from '../componentes/BarrasHorizontais'
import { CaixaErro, Carregando } from '../componentes/Estados'
import { GraficoRosca } from '../componentes/GraficoRosca'
import { NumeroAnimado } from '../componentes/NumeroAnimado'
import { TabelaPaginada, type Coluna } from '../componentes/TabelaPaginada'
import { useFiltros } from '../filtros'
import { AUSENTE, dataHora, inteiro, moeda, percentual } from '../formato'
import { BarraProgresso, CartaoDestaque, MarcaCompartilhado, linkDetalhe } from './comum'
import { useConvenioRecemAdicionado } from './NovoConvenio'

// Visão geral fixa da carteira: não usa recorte, município nem mês da URL (só `pagina`/`ordem` da lista).
// "Cadastrados" é o recorte mais amplo (Histórico inicial, 342); os valores contratuais são dos Vigentes (31).
const CADASTRADOS = '342'
const VIGENTES = '31'
const ORDEM_PADRAO_VIGENTES = '-valor_total'
const SEM_FILTRO = { municipios: [] } as const
// A API separa quem a planilha histórica marca como "Vigente" fora do último repasse; na rosca, vai para "Outros".
const SEM_FATIA_STATUS = ['Vigência não confirmada']

function municipios(n: number | undefined): ReactNode {
  return n === undefined ? null : <p>em {inteiro(n)} {n === 1 ? 'município' : 'municípios'}</p>
}

/** Rodapé de card com uma fração: texto e percentual na mesma linha, barra embaixo (nulo → "—" e sem barra). */
function Proporcao({
  pct,
  texto,
  rotulo,
  invertido,
  children,
}: {
  pct: number | null | undefined
  texto: string
  rotulo: string
  /** Sobre card escuro: texto e barra claros. */
  invertido?: boolean
  children?: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      {children && <div className={`text-sm ${invertido ? 'text-white' : 'text-slate-600'}`}>{children}</div>}
      <p className={`flex items-baseline justify-between gap-2 text-xs ${invertido ? '' : 'text-slate-500'}`}>
        <span>{texto}</span>
        <span className={`text-sm font-semibold tabular-nums ${invertido ? 'text-white' : 'text-marca-700'}`}>
          {percentual(pct)}
        </span>
      </p>
      <BarraProgresso
        pct={pct}
        rotulo={rotulo}
        {...(invertido ? { cor: 'bg-white', trilho: 'bg-white/20' } : {})}
      />
    </div>
  )
}

function CartoesGerais() {
  const cadastrados = useResumoRecorte(CADASTRADOS)
  const vigentes = useResumoRecorte(VIGENTES)
  const munCadastrados = useRankingRecorte(CADASTRADOS, 10, '-convenios')
  const munVigentes = useRankingRecorte(VIGENTES, 1)

  const falha = cadastrados.isError ? cadastrados : vigentes.isError ? vigentes : null
  if (falha) {
    return (
      <CaixaErro erro={falha.error} onTentar={() => void falha.refetch()} titulo="Não foi possível carregar os totais" />
    )
  }
  const c = cadastrados.data
  const v = vigentes.data
  if (!c || !v) return <Carregando texto="Carregando os totais…" />
  const contratual = v.contratual
  // Os Vigentes estão contidos nos cadastrados (31 ⊂ 342), então a fração é uma parte do todo.
  const vigentesPct = c.convenios > 0 ? (v.convenios / c.convenios) * 100 : null

  // Duas linhas proporcionais: as quantidades (meia largura cada) e os três valores em reais (um terço cada).
  return (
    <div className="grade-surgir grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
      <CartaoDestaque
        rotulo="Cadastrados"
        valor={<NumeroAnimado valor={c.convenios} formatar={inteiro} />}
        escuro
        grande
        className="lg:col-span-3"
      >
        <p className="text-sm text-white">convênios</p>
        {municipios(munCadastrados.data?.total)}
      </CartaoDestaque>
      <CartaoDestaque
        rotulo="Vigentes"
        valor={<NumeroAnimado valor={v.convenios} formatar={inteiro} />}
        escuro
        tom="verde"
        grande
        className="lg:col-span-3"
      >
        <Proporcao pct={vigentesPct} texto="dos cadastrados" rotulo="Vigentes sobre os cadastrados" invertido>
          {municipios(munVigentes.data?.total)}
        </Proporcao>
      </CartaoDestaque>
      <CartaoDestaque
        rotulo="Valor total conveniado"
        valor={<NumeroAnimado valor={contratual?.valor_total} formatar={moeda} />}
        className="lg:col-span-2"
      >
        <p className="text-xs text-slate-500">dos convênios vigentes</p>
      </CartaoDestaque>
      <CartaoDestaque
        rotulo="Investido pelo Estado"
        valor={<NumeroAnimado valor={contratual?.investido_estado} formatar={moeda} />}
        className="lg:col-span-2"
      >
        <Proporcao
          pct={contratual?.investido_sobre_total_pct}
          texto="do valor conveniado"
          rotulo="Investido sobre o valor conveniado"
        />
      </CartaoDestaque>
      <CartaoDestaque
        rotulo="A repassar"
        valor={<NumeroAnimado valor={contratual?.a_repassar} formatar={moeda} />}
        className="sm:col-span-2 lg:col-span-2"
      >
        <p className="text-xs text-slate-500">saldo dos convênios vigentes</p>
      </CartaoDestaque>
    </div>
  )
}

function Status() {
  const consulta = useResumoRecorte(CADASTRADOS)
  if (consulta.isError) {
    return <CaixaErro erro={consulta.error} onTentar={() => void consulta.refetch()} titulo="Não foi possível carregar os status" />
  }
  if (!consulta.data) return <Carregando texto="Carregando os status…" />
  const itens = (consulta.data.situacao?.status ?? []).map((s) => ({ rotulo: s.valor, valor: s.convenios }))
  return (
    <GraficoRosca
      titulo="Convênios por status"
      subtitulo="Os 5 status mais frequentes entre os cadastrados; os demais somados em “Outros”."
      nota="“Vigente” são os convênios do último repasse. Os que a planilha ainda marca como vigentes fora dele entram em “Outros”."
      itens={itens}
      semFatia={SEM_FATIA_STATUS}
      vazio="Nenhum convênio cadastrado."
    />
  )
}

function TopMunicipios() {
  const consulta = useRankingRecorte(CADASTRADOS, 10, '-convenios')
  if (consulta.isError) {
    return (
      <CaixaErro erro={consulta.error} onTentar={() => void consulta.refetch()} titulo="Não foi possível carregar os municípios" />
    )
  }
  if (!consulta.data) return <Carregando texto="Carregando os municípios…" />
  const itens = consulta.data.itens.map((m) => ({ rotulo: m.municipio, valor: m.convenios }))
  return (
    <BarrasHorizontais
      titulo="Top 10 municípios"
      subtitulo="Com mais convênios cadastrados"
      itens={itens}
      vazio="Nenhum município com convênio."
    />
  )
}

const COLUNAS_VIGENTES: Coluna<LinhaConvenio>[] = [
  {
    campo: 'numero_convenio',
    rotulo: 'Número',
    ordenavel: true,
    fixa: true,
    valor: (i) => (
      <>
        {i.numero_convenio}
        {i.codigo_compartilhado && <MarcaCompartilhado />}
      </>
    ),
  },
  { campo: 'municipio', rotulo: 'Município', ordenavel: true, valor: (i) => i.municipio },
  { campo: 'status', rotulo: 'Status', ordenavel: true, valor: (i) => i.status ?? AUSENTE },
  { campo: 'valor_total', rotulo: 'Valor total', ordenavel: true, numerica: true, valor: (i) => moeda(i.valor_total) },
  {
    campo: 'investido_estado',
    rotulo: 'Investido pelo Estado',
    ordenavel: true,
    numerica: true,
    valor: (i) => moeda(i.investido_estado),
  },
  { campo: 'a_repassar', rotulo: 'A repassar', ordenavel: true, numerica: true, valor: (i) => moeda(i.a_repassar) },
]

function ListaVigentes() {
  const { filtros, mudar } = useFiltros()
  const ordem = filtros.ordem ?? ORDEM_PADRAO_VIGENTES
  const consulta = useConvenios({ recorte: VIGENTES, ...SEM_FILTRO }, null, { pagina: filtros.pagina, ordem })
  const editar = useEditarConvenio()
  const remover = useRemoverConvenio()
  const [recemAdicionado] = useConvenioRecemAdicionado()
  const navegar = useNavigate()
  const d = consulta.data

  return (
    <section aria-label="Convênios vigentes" className="space-y-3">
      <div>
        <h2 className="titulo-secao">Convênios vigentes</h2>
        <p className="subtitulo-secao">Do maior para o menor valor total. Clique em uma linha para abrir o detalhe.</p>
      </div>
      {consulta.isError ? (
        <CaixaErro erro={consulta.error} onTentar={() => void consulta.refetch()} titulo="Não foi possível carregar os vigentes" />
      ) : !d ? (
        <Carregando texto="Carregando os vigentes…" />
      ) : (
        <TabelaPaginada
          colunas={COLUNAS_VIGENTES}
          itens={d.itens}
          chave={(i) => `${i.numero_convenio}|${i.municipio}`}
          total={d.total}
          pagina={filtros.pagina}
          tamanho={TAMANHO_PAGINA}
          ordem={ordem}
          onOrdem={(o) => mudar({ ordem: o })}
          onPagina={(pagina) => mudar({ pagina })}
          onLinha={(i) => navegar(linkDetalhe(i.numero_convenio, i.municipio))}
          rotuloLinha={(i) => `Ver detalhe do convênio ${i.numero_convenio} de ${i.municipio}`}
          unidade={['convênio vigente', 'convênios vigentes']}
          vazio="Nenhum convênio vigente."
          atualizando={consulta.isPlaceholderData}
          destacarLinha={(i) =>
            Boolean(
              recemAdicionado &&
                i.numero_convenio === recemAdicionado.numero_convenio &&
                i.municipio === recemAdicionado.municipio,
            )
          }
          onSalvarEdicao={(item, alt) =>
            editar.mutateAsync({ ...alt, numero_convenio: item.numero_convenio, municipio: item.municipio })
          }
          onRemoverItem={(item) =>
            remover.mutateAsync({ numero: item.numero_convenio, municipio: item.municipio })
          }
        />
      )}
    </section>
  )
}

function DatasCargas() {
  const r = useResumoRecorte(CADASTRADOS).data
  if (!r) return null
  return (
    <p className="border-t border-slate-200/70 pt-4 text-xs text-slate-600">
      Posição do SIAFE em {dataHora(r.referencia.posicao_siafe_em)} · planilha importada em{' '}
      {dataHora(r.referencia.planilha_importada_em)}
      {r.referencia.arquivo ? ` (${r.referencia.arquivo})` : ''}
      {!r.referencia.posicao_siafe_em && !r.referencia.planilha_importada_em ? ` ${AUSENTE}` : ''}
    </p>
  )
}

export function TelaVisaoGeral() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-tela">Visão geral</h1>
        <p className="subtitulo-tela">Resumo de toda a carteira de convênios, sem filtros.</p>
      </header>
      <CartoesGerais />
      <div className="grid gap-6 xl:grid-cols-2">
        <Status />
        <TopMunicipios />
      </div>
      <ListaVigentes />
      <DatasCargas />
    </div>
  )
}
