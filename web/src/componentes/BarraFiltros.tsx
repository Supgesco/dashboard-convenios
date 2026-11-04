import { useId, useState } from 'react'

import { useOpcoesMunicipios } from '../api/hooks'
import { RECORTES, type Recorte } from '../api/tipos'
import { useFiltros, useMesReferencia } from '../filtros'
import { mesAno } from '../formato'

export const ROTULO_RECORTE: Record<Recorte, string> = {
  '31': '31 · vigentes',
  '89': '89 · primeiro repasse',
  '342': '342 · todos',
}

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
        <summary className="campo cursor-pointer list-none select-none">
          Municípios: {selecionados.length ? selecionados.length : 'todos'} ▾
        </summary>
        <div className="absolute z-20 mt-1 w-72 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
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
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={selecionados.includes(m)} onChange={() => alternar(m)} />
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
        <span key={m} className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-900">
          {m}
          <button type="button" aria-label={`Remover ${m}`} onClick={() => alternar(m)} className="hover:text-sky-700">
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
  const valorMes = ref.mes ? `${ref.mes.ano}-${String(ref.mes.mes).padStart(2, '0')}` : ''

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-slate-200 bg-white px-6 py-3">
      <div role="group" aria-label="Recorte" className="inline-flex overflow-hidden rounded-md border border-slate-300">
        {RECORTES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={filtros.recorte === r}
            onClick={() => mudar({ recorte: r })}
            className={`px-3 py-1 text-sm ${
              filtros.recorte === r ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {ROTULO_RECORTE[r]}
          </button>
        ))}
      </div>

      <SeletorMunicipios
        recorte={filtros.recorte}
        selecionados={filtros.municipios}
        onMudar={(municipios) => mudar({ municipios })}
      />

      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="mes-referencia" className="text-slate-600">
          Mês de referência
        </label>
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
        {ref.mes && <span className="text-slate-500">{mesAno(ref.mes.ano, ref.mes.mes)}</span>}
        {ref.daUrl ? (
          <button type="button" className="botao-link" onClick={() => mudar({ mes: null })}>
            usar o último disponível
          </button>
        ) : (
          ref.mes && <span className="text-slate-500">(último disponível)</span>
        )}
      </div>
    </div>
  )
}
