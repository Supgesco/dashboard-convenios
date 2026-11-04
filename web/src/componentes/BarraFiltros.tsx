import { useId, useState } from 'react'

import { useContagemRecortes, useOpcoesMunicipios } from '../api/hooks'
import type { Recorte } from '../api/tipos'
import { useFiltros, useMesReferencia } from '../filtros'
import { mesAno } from '../formato'
import { NOME_RECORTE, ORDEM_EXIBICAO, rotuloRecorte, textoConvenios } from '../recortes'

function SeletorMunicipios({ recorte, selecionados, onMudar }: {
  recorte: Recorte
  selecionados: readonly string[]
  onMudar: (m: string[]) => void
}) {
  const opcoes = useOpcoesMunicipios(recorte)
  const [busca, setBusca] = useState('')
  const idBusca = useId()
  const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const visiveis = (opcoes.data ?? []).filter((m) => normal(m).includes(normal(busca)))

  const alternar = (m: string) =>
    onMudar(selecionados.includes(m) ? selecionados.filter((s) => s !== m) : [...selecionados, m])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <details className="relative">
        <summary className="campo inline-flex cursor-pointer list-none items-center gap-2 select-none">
          Municípios: {selecionados.length ? selecionados.length : 'todos'}
          <span aria-hidden="true" className="text-slate-400">▾</span>
        </summary>
        <div className="absolute z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <label htmlFor={idBusca} className="sr-only">
            Buscar município
          </label>
          <input
            id={idBusca}
            className="campo mb-2 w-full"
            placeholder="Buscar município"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {opcoes.isPending ? (
            <p className="p-2 text-sm text-slate-500">Carregando…</p>
          ) : opcoes.isError ? (
            <p className="p-2 text-sm text-red-800">Não foi possível carregar os municípios.</p>
          ) : (
            <ul className="max-h-64 overflow-auto" aria-label="Municípios do recorte">
              {visiveis.map((m) => (
                <li key={m}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-marca-50">
                    <input type="checkbox" className="accent-marca-600" checked={selecionados.includes(m)} onChange={() => alternar(m)} />
                    {m}
                  </label>
                </li>
              ))}
              {visiveis.length === 0 && <li className="p-2 text-sm text-slate-500">Nenhum município.</li>}
            </ul>
          )}
        </div>
      </details>
      {selecionados.map((m) => (
        <span
          key={m}
          className="inline-flex items-center gap-1 rounded-full border border-marca-100 bg-marca-50 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-marca-800"
        >
          {m}
          <button type="button" aria-label={`Remover ${m}`} onClick={() => alternar(m)} className="rounded-full px-1 text-marca-600 hover:bg-marca-100 hover:text-marca-800">
            ×
          </button>
        </span>
      ))}
    </div>
  )
}

export function BarraFiltros() {
  const { filtros, mudar } = useFiltros()
  const ref = useMesReferencia(filtros.mes)
  const contagem = useContagemRecortes()
  const valorMes = ref.mes ? `${ref.mes.ano}-${String(ref.mes.mes).padStart(2, '0')}` : ''

  return (
    <section aria-label="Filtros" className="cartao flex flex-col gap-4 xl:flex-row xl:items-end xl:gap-6">
      <div className="min-w-0">
        <p className="rotulo-campo mb-1.5" aria-hidden="true">
          Recorte
        </p>
        <div
          role="group"
          aria-label="Recorte"
          className="grid grid-cols-1 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-3"
        >
          {ORDEM_EXIBICAO.map((r) => {
            const ativo = filtros.recorte === r
            const qtd = textoConvenios(contagem[r])
            return (
              <button
                key={r}
                type="button"
                aria-pressed={ativo}
                aria-label={rotuloRecorte(r, contagem[r])}
                onClick={() => mudar({ recorte: r })}
                className={`rounded-lg px-4 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-marca-600 sm:min-w-44 ${
                  ativo ? 'bg-white text-marca-800 shadow-sm ring-1 ring-marca-200' : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                <span className="block whitespace-nowrap text-sm font-semibold">{NOME_RECORTE[r]}</span>
                <span className={`block text-xs tabular-nums ${ativo ? 'text-marca-700' : 'text-slate-500'}`}>
                  {qtd ?? ' '}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div>
          <p className="rotulo-campo mb-1.5">Municípios</p>
          <SeletorMunicipios
            recorte={filtros.recorte}
            selecionados={filtros.municipios}
            onMudar={(municipios) => mudar({ municipios })}
          />
        </div>

        <div>
          <label htmlFor="mes-referencia" className="rotulo-campo mb-1.5 block">
            Mês de referência
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              id="mes-referencia"
              type="month"
              className="campo"
              value={valorMes}
              min="2023-01"
              onChange={(e) => {
                const [a, m] = e.target.value.split('-').map(Number)
                mudar({ mes: a && m ? { ano: a, mes: m } : null })
              }}
            />
            {ref.mes && <span className="text-slate-600">{mesAno(ref.mes.ano, ref.mes.mes)}</span>}
            {ref.daUrl ? (
              <button type="button" className="botao-link" onClick={() => mudar({ mes: null })}>
                usar o último disponível
              </button>
            ) : (
              ref.mes && <span className="text-slate-500">(último disponível)</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
