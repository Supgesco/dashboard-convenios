import { useNavigate } from 'react-router'

import { TAMANHO_PAGINA, useConvenios, useResumo } from '../api/hooks'
import type { LinhaConvenio } from '../api/tipos'
import { Aviso, CaixaErro, Carregando } from '../componentes/Estados'
import { TabelaPaginada, type Coluna } from '../componentes/TabelaPaginada'
import { useFiltros, useMesReferencia, type Filtros, type MesReferencia } from '../filtros'
import { AUSENTE, mesAno, moeda, percentual } from '../formato'
import { CAMPOS_CONTRATUAL, CAMPOS_SALDO, CartoesSaldo, LegendaCompartilhado, MarcaCompartilhado, linkDetalhe } from './comum'

// Campos ordenáveis = whitelist da API (consultas.ORDEM_LISTA); os códigos não são ordenáveis.
const BASE: Coluna<LinhaConvenio>[] = [
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
  { campo: 'fase', rotulo: 'Fase', ordenavel: true, valor: (i) => i.fase },
  { campo: 'codigo_seobras', rotulo: 'SEOBRAS', valor: (i) => i.codigo_seobras ?? AUSENTE },
  { campo: 'codigo_seiop', rotulo: 'SEIOP', valor: (i) => i.codigo_seiop ?? AUSENTE },
  ...CAMPOS_SALDO.map(({ campo, rotulo }) => ({
    campo,
    rotulo,
    ordenavel: true,
    numerica: true,
    valor: (i: LinhaConvenio) => moeda(i[campo]),
  })),
]

const CONTRATUAIS: Coluna<LinhaConvenio>[] = CAMPOS_CONTRATUAL.map(({ campo, rotulo, pct }) => ({
  campo,
  rotulo,
  ordenavel: true,
  numerica: true,
  valor: (i: LinhaConvenio) => (pct ? percentual(i[campo]) : moeda(i[campo])),
}))

/** Os 4 saldos SIAFE do recorte, dos municípios e do mês em uso, com a variação sobre o mês anterior. */
function SaldosDoFiltro({ filtros, referencia, onLimpar }: { filtros: Filtros; referencia: MesReferencia; onLimpar: () => void }) {
  const resumo = useResumo(filtros, referencia.mes, { enabled: referencia.resolvido })
  const r = resumo.data
  if (resumo.isError) {
    return (
      <CaixaErro
        erro={resumo.error}
        onTentar={() => void resumo.refetch()}
        onLimpar={onLimpar}
        titulo="Não foi possível carregar os saldos"
      />
    )
  }
  if (!r) return <Carregando texto="Carregando os saldos…" />
  return (
    <section aria-label="Saldos SIAFE" className="space-y-4">
      {!r.siafe && (
        <Aviso>
          O SIAFE não tem dados de {mesAno(r.referencia.ano, r.referencia.mes)}.{' '}
          {r.referencia.ultimo_mes_disponivel
            ? `Último mês disponível: ${mesAno(r.referencia.ultimo_mes_disponivel.ano, r.referencia.ultimo_mes_disponivel.mes)}.`
            : 'Nenhum mês foi carregado.'}
        </Aviso>
      )}
      <CartoesSaldo saldos={r.siafe} anterior={r.siafe?.mes_anterior} />
    </section>
  )
}

export function TelaConvenios() {
  const { filtros, busca, mudar, limpar } = useFiltros()
  const ref = useMesReferencia(filtros.mes)
  const consulta = useConvenios(filtros, ref.mes, filtros, { enabled: ref.resolvido })
  const navegar = useNavigate()
  const colunas = filtros.recorte === '342' ? BASE : [...BASE, ...CONTRATUAIS]
  const d = consulta.data

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-tela">Convênios</h1>
        <p className="subtitulo-tela">
          {d && <span className="font-medium text-slate-700">{mesAno(d.ano, d.mes)} · </span>}
          Lista de convênios do recorte. Clique em uma linha para abrir o detalhe.
        </p>
      </header>
      <SaldosDoFiltro filtros={filtros} referencia={ref} onLimpar={limpar} />
      {consulta.isError ? (
        <CaixaErro erro={consulta.error} onTentar={() => void consulta.refetch()} onLimpar={limpar} />
      ) : !d ? (
        <Carregando />
      ) : (
        <>
          <TabelaPaginada
            colunas={colunas}
            itens={d.itens}
            chave={(i) => `${i.numero_convenio}|${i.municipio}`}
            total={d.total}
            pagina={filtros.pagina}
            tamanho={TAMANHO_PAGINA}
            ordem={filtros.ordem}
            onOrdem={(ordem) => mudar({ ordem })}
            onPagina={(pagina) => mudar({ pagina })}
            onLinha={(i) => navegar(linkDetalhe(i.numero_convenio, i.municipio, busca))}
            rotuloLinha={(i) => `Ver detalhe do convênio ${i.numero_convenio} de ${i.municipio}`}
            unidade={['convênio', 'convênios']}
            vazio="Nenhum convênio neste filtro."
            atualizando={consulta.isPlaceholderData}
          />
          <LegendaCompartilhado />
        </>
      )}
    </div>
  )
}
