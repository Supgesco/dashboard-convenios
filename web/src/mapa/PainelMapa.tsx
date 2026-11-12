// Bloco do mapa na tela Municípios: dados do recorte, estados de carregando/erro, legenda e o mapa (sob demanda).
import { Suspense, lazy, useMemo } from 'react'
import { useNavigate } from 'react-router'

import { useMunicipiosRecorte } from '../api/hooks'
import type { Recorte } from '../api/tipos'
import { CaixaErro, Carregando } from '../componentes/Estados'
import { NOME_RECORTE } from '../recortes'
import { COR_SEM, chave, coresFaixas, faixas as calcularFaixas, linkMunicipio, rotuloFaixa, type Faixa } from './logica'

const MapaMunicipios = lazy(() => import('./MapaMunicipios'))

/** Exibe a legenda cromática das faixas de quantidade de convênios do mapa. */
export function LegendaMapa({ faixas }: { faixas: readonly Faixa[] }) {
  const cores = coresFaixas(faixas)
  const itens = [
    { rotulo: 'Sem convênio', cor: COR_SEM },
    ...faixas.map((f, i) => ({ rotulo: rotuloFaixa(f), cor: cores[i] })),
  ]
  return (
    <ul aria-label="Legenda do mapa" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
      <li className="font-medium text-slate-700" aria-hidden="true">
        Convênios:
      </li>
      {itens.map((i) => (
        <li key={i.rotulo} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3.5 rounded-[4px] ring-1 ring-slate-900/10"
            style={{ backgroundColor: i.cor }}
          />
          <span className="tabular-nums">{i.rotulo}</span>
        </li>
      ))}
    </ul>
  )
}

/** Seção do mapa na tela de Municípios, gerenciando carregamento, erro, legenda e navegação para detalhes. */
export function PainelMapa({
  recorte,
  municipios,
  busca,
}: {
  recorte: Recorte
  /** Municípios do filtro da URL. */
  municipios: readonly string[]
  busca: URLSearchParams
}) {
  const consulta = useMunicipiosRecorte(recorte)
  const navegar = useNavigate()
  const linhas = consulta.data
  const faixas = useMemo(() => calcularFaixas((linhas ?? []).map((l) => l.convenios)), [linhas])
  const selecionados = useMemo(() => new Set(municipios.map(chave)), [municipios])

  return (
    <section aria-label="Mapa de convênios por município" className="cartao space-y-4">
      <div>
        <h2 className="titulo-secao">Convênios por município · {NOME_RECORTE[recorte]}</h2>
        <p className="subtitulo-secao">
          Quantidade de convênios do recorte em cada município. Clique em um município para ver seus convênios; a
          tabela abaixo traz os mesmos dados.
        </p>
      </div>
      {consulta.isError ? (
        <CaixaErro
          erro={consulta.error}
          onTentar={() => void consulta.refetch()}
          titulo="Não foi possível carregar o mapa"
        />
      ) : !linhas ? (
        <Carregando texto="Carregando o mapa…" />
      ) : (
        <>
          <Suspense fallback={<Carregando texto="Carregando o mapa…" />}>
            <div className="animate-surgir overflow-hidden rounded-xl ring-1 ring-slate-200">
              <MapaMunicipios
                linhas={linhas}
                faixas={faixas}
                selecionados={selecionados}
                onMunicipio={(nome) => navegar(linkMunicipio(busca, nome), { state: { veioDoMapa: true } })}
              />
            </div>
          </Suspense>
          <LegendaMapa faixas={faixas} />
        </>
      )}
    </section>
  )
}
