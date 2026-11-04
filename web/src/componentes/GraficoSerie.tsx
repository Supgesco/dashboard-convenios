import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { PontoSerie } from '../api/tipos'
import { AUSENTE, mesAno, moeda, moedaCurta } from '../formato'
import { SERIES } from '../series'

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
        <div className="max-h-80 overflow-auto rounded-lg border border-slate-200/80">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="text-left text-xs text-slate-600">
              <tr>
                <th scope="col" className="sticky top-0 border-b border-slate-200 bg-slate-50 px-3 py-2 font-medium">
                  Mês
                </th>
                {SERIES.map((s) => (
                  <th
                    key={s.campo}
                    scope="col"
                    className="sticky top-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-right font-medium"
                  >
                    {s.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.rotulo} className="even:bg-slate-50/60">
                  <td className="border-b border-slate-100 px-3 py-2">{d.rotulo}</td>
                  {SERIES.map((s) => (
                    <td key={s.campo} className="border-b border-slate-100 px-3 py-2 text-right tabular-nums">
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
              <CartesianGrid stroke="#e6ecf4" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} minTickGap={24} />
              <YAxis
                tickFormatter={(v: number) => moedaCurta(v)}
                tick={{ fontSize: 12, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
                width={84}
              />
              <Tooltip
                formatter={(v) => (typeof v === 'number' ? moeda(v) : AUSENTE)}
                labelStyle={{ fontWeight: 600, color: '#0f172a' }}
                itemStyle={{ color: '#0f172a' }}
                cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
              />
              <Legend iconType="plainline" itemSorter={null} wrapperStyle={{ fontSize: 12, color: '#475569' }} />
              {SERIES.map((s) => (
                <Line
                  key={s.campo}
                  type="linear"
                  dataKey={s.campo}
                  name={s.rotulo}
                  stroke={s.cor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
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
