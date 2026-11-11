import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { TAMANHO_PAGINA, useConvenios, useEditarConvenio, useRemoverConvenio, useResumo } from '../api/hooks'
import type { LinhaConvenio } from '../api/tipos'
import { Aviso, CaixaErro, Carregando } from '../componentes/Estados'
import { TabelaPaginada, type Coluna } from '../componentes/TabelaPaginada'
import { useFiltros, useMesReferencia, type Filtros, type MesReferencia } from '../filtros'
import { AUSENTE, mesAno, moeda, percentual } from '../formato'
import { exportarPdfPorChave } from '../relatorioPdf'
import { CAMPOS_CONTRATUAL, CAMPOS_SALDO, CartoesSaldo, LegendaCompartilhado, MarcaCompartilhado, linkDetalhe } from './comum'
import { FormularioNovoConvenio, useConvenioRecemAdicionado, useExibirNovoConvenio } from './NovoConvenio'

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
  const editar = useEditarConvenio()
  const remover = useRemoverConvenio()
  const navegar = useNavigate()
  const [exibirFormNovo, setExibirFormNovo] = useExibirNovoConvenio()
  const [recemAdicionado, setRecemAdicionado] = useConvenioRecemAdicionado()
  const [criadosLocal, setCriadosLocal] = useState<LinhaConvenio[]>([])
  const colunas = filtros.recorte === '342' ? BASE : [...BASE, ...CONTRATUAIS]
  const d = consulta.data

  useEffect(() => {
    return () => setExibirFormNovo(false)
  }, [setExibirFormNovo])

  const itensComNovos = d
    ? [
        ...criadosLocal.filter(
          (n) => !d.itens.some((x) => x.numero_convenio === n.numero_convenio && x.municipio === n.municipio),
        ),
        ...d.itens,
      ]
    : []

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-tela">{exibirFormNovo ? 'Novo Convênio' : 'Convênios'}</h1>
        <p className="subtitulo-tela">
          {exibirFormNovo ? (
            'Cadastre um novo convênio com normalização automática de códigos SIAFE (SEOBRAS e SEIOP), saldos contábeis, valores contratuais e vínculo opcional com Prestação e Tomada de Contas.'
          ) : (
            <>
              {d && <span className="font-medium text-slate-700">{mesAno(d.ano, d.mes)} · </span>}
              Lista de convênios do recorte. Clique em uma linha para abrir o detalhe.
            </>
          )}
        </p>
      </header>
      {recemAdicionado && !exibirFormNovo && (
        <div
          role="status"
          className="animate-surgir flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-marca-200 bg-marca-50/90 px-4 py-3 text-sm text-marca-950 shadow-cartao"
        >
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-marca-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-white" />
              Recém-adicionado
            </span>
            <span>
              Convênio <strong className="font-semibold">{recemAdicionado.numero_convenio}</strong> de{' '}
              <strong className="font-semibold">{recemAdicionado.municipio}</strong> foi incluído na base
              {(recemAdicionado.codigo_seobras || recemAdicionado.codigo_seiop) && (
                <span className="ml-1 text-xs text-slate-600">
                  (SEOBRAS: <span className="font-mono">{recemAdicionado.codigo_seobras ?? '—'}</span> · SEIOP:{' '}
                  <span className="font-mono">{recemAdicionado.codigo_seiop ?? '—'}</span>)
                </span>
              )}
              .
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navegar(linkDetalhe(recemAdicionado.numero_convenio, recemAdicionado.municipio, busca))}
              className="rounded-lg border border-marca-200 bg-white px-2.5 py-1 text-xs font-semibold text-marca-800 transition-colors hover:bg-marca-100"
            >
              Ver detalhe
            </button>
            <button
              type="button"
              aria-label="Fechar notificação"
              onClick={() => setRecemAdicionado(null)}
              className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-marca-100 hover:text-slate-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {exibirFormNovo ? (
        <FormularioNovoConvenio
          onCriado={(novo) => {
            setCriadosLocal((ant) => [
              novo,
              ...ant.filter((x) => !(x.numero_convenio === novo.numero_convenio && x.municipio === novo.municipio)),
            ])
            void consulta.refetch()
          }}
          onVoltarLista={() => setExibirFormNovo(false)}
        />
      ) : (
        <>
          <SaldosDoFiltro filtros={filtros} referencia={ref} onLimpar={limpar} />
          {consulta.isError ? (
            <CaixaErro erro={consulta.error} onTentar={() => void consulta.refetch()} onLimpar={limpar} />
          ) : !d ? (
            <Carregando />
          ) : (
            <>
              <TabelaPaginada
                colunas={colunas}
                itens={itensComNovos}
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
                onExportarPdf={(item) => exportarPdfPorChave(item.numero_convenio, item.municipio, ref.mes)}
                onRemoverItem={async (item) => {
                  await remover.mutateAsync({ numero: item.numero_convenio, municipio: item.municipio })
                  setCriadosLocal((ant) =>
                    ant.filter((x) => !(x.numero_convenio === item.numero_convenio && x.municipio === item.municipio)),
                  )
                  if (
                    recemAdicionado?.numero_convenio === item.numero_convenio &&
                    recemAdicionado?.municipio === item.municipio
                  ) {
                    setRecemAdicionado(null)
                  }
                }}
              />
              <LegendaCompartilhado />
            </>
          )}
        </>
      )}
    </div>
  )
}
