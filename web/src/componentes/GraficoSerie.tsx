import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { PontoSerie } from '../api/tipos'
import { AUSENTE, mesAno, moeda, moedaCurta } from '../formato'

// Paleta categórica da skill de dataviz, slots 1–4 em ordem fixa (validada para daltonismo e visão normal).
// Verde-água e amarelo ficam abaixo de 3:1 no fundo claro: por isso legenda sempre visível + visão em tabela.
export const SERIES = [
  { campo: 'a_pagar', rotulo: 'A pagar', cor: '#2a78d6' },
  { campo: 'a_comprovar', rotulo: 'A comprovar', cor: '#eb6834' },
  { campo: 'a_aprovar', rotulo: 'A aprovar', cor: '#1baf7a' },
  { campo: 'aprovados', rotulo: 'Aprovados', cor: '#eda100' },
] as const

interface Props {
  pontos: PontoSerie[]
  titulo: string
}

/** Série mensal dos 4 saldos (um eixo só, todos em R$). Mês sem dado vira lacuna, nunca zero. */
export function GraficoSerie({ pontos, titulo }: Props) {
  const [tabela, setTabela] = useState(false)
  const dados = pontos.map((p) => ({ ...p, rotulo: mesAno(p.ano, p.mes) }))

  return (
    <section className="cartao" aria-label={titulo}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="titulo-secao">{titulo}</h2>
        <button type="button" className="botao-link" onClick={() => setTabela((t) => !t)} aria-pressed={tabela}>
          {tabela ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>
      {pontos.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">Nenhum mês carregado.</p>
      ) : tabela ? (
        <div className="max-h-80 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-2 py-1">
                  Mês
                </th>
                {SERIES.map((s) => (
                  <th key={s.campo} scope="col" className="px-2 py-1 text-right">
                    {s.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dados.map((d) => (
                <tr key={d.rotulo}>
                  <td className="px-2 py-1">{d.rotulo}</td>
                  {SERIES.map((s) => (
                    <td key={s.campo} className="px-2 py-1 text-right tabular-nums">
                      {moeda(d[s.campo])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: '#52514e' }} tickLine={false} minTickGap={24} />
              <YAxis
                tickFormatter={(v: number) => moedaCurta(v)}
                tick={{ fontSize: 12, fill: '#52514e' }}
                tickLine={false}
                axisLine={false}
                width={84}
              />
              <Tooltip
                formatter={(v) => (typeof v === 'number' ? moeda(v) : AUSENTE)}
                labelStyle={{ fontWeight: 600, color: '#0b0b0b' }}
                itemStyle={{ color: '#0b0b0b' }}
                cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
              />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: '#52514e' }} />
              {SERIES.map((s) => (
                <Line
                  key={s.campo}
                  type="linear"
                  dataKey={s.campo}
                  name={s.rotulo}
                  stroke={s.cor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: '#fcfcfb', strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
