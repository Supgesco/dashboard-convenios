import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { PontoSerie } from '../api/tipos'
import { AUSENTE, mesAno, moeda, moedaCurta } from '../formato'
import { ANIMAR } from '../movimento'
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="titulo-secao">{titulo}</h2>
        <button type="button" className="botao-secundario" onClick={() => setTabela((t) => !t)} aria-pressed={tabela}>
          {tabela ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>
      {pontos.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">Nenhum mês carregado.</p>
      ) : tabela ? (
        <div className="max-h-80 animate-surgir overflow-auto rounded-xl border border-slate-200/70">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col" className="tabela-th sticky top-0">
                  Mês
                </th>
                {SERIES.map((s) => (
                  <th
                    key={s.campo}
                    scope="col"
                    className="tabela-th sticky top-0 text-right"
                  >
                    {s.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.rotulo} className="hover:bg-slate-50/70">
                  <td className="tabela-td">{d.rotulo}</td>
                  {SERIES.map((s) => (
                    <td key={s.campo} className="tabela-td text-right tabular-nums">
                      {moeda(d[s.campo])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-80 animate-surgir">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="rotulo"
                tick={{ fontSize: 12, fill: '#475569' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                minTickGap={24}
                dy={6}
              />
              <YAxis
                tickFormatter={(v: number) => moedaCurta(v)}
                tick={{ fontSize: 12, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
                width={84}
              />
              <Tooltip
                formatter={(v) => (typeof v === 'number' ? moeda(v) : AUSENTE)}
                labelStyle={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 12px 28px -8px rgb(15 23 42 / 0.18)',
                  padding: '10px 12px',
                  fontSize: 13,
                }}
                itemStyle={{ color: '#0f172a' }}
                cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                itemSorter={null}
                verticalAlign="top"
                align="left"
                wrapperStyle={{ fontSize: 12, color: '#475569', paddingBottom: 16 }}
                formatter={(rotulo) => <span style={{ color: '#475569' }}>{rotulo}</span>}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.campo}
                  type="linear"
                  dataKey={s.campo}
                  name={s.rotulo}
                  stroke={s.cor}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={ANIMAR}
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
