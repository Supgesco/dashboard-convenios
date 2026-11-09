import { Fragment, useState } from 'react'
import { Pie, PieChart, Sector, Tooltip, type PieSectorShapeProps } from 'recharts'

import { inteiro, percentual } from '../formato'
import { ANIMAR } from '../movimento'
import { agruparTop, type FatiaRosca, type ItemRosca } from '../rosca'
import { NumeroAnimado } from './NumeroAnimado'

interface Props {
  titulo: string
  subtitulo?: string
  itens: readonly ItemRosca[]
  /** Quantos itens ganham fatia própria antes do "Outros". */
  top?: number
  /** Rótulos que sempre vão para "Outros", sem fatia própria. */
  semFatia?: readonly string[]
  /** Palavra do total no centro ("convênios"). */
  unidade?: string
  vazio?: string
  /** Observação curta no rodapé do card (como ler o gráfico). */
  nota?: string
}

const TAMANHO = 216

/** Rótulo que pode quebrar linha depois de "/" (ex.: "Expirado/Cancelado"), sem cortar palavras. */
function RotuloQuebravel({ texto }: { texto: string }) {
  const partes = texto.split('/')
  return partes.map((p, i) => (
    <Fragment key={i}>
      {p}
      {i < partes.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ))
}

function DicaFatia({ active, payload }: { active?: boolean; payload?: readonly { payload?: FatiaRosca }[] }) {
  const f = payload?.[0]?.payload
  if (!active || !f) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] shadow-cartao-alto">
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: f.cor }} />
        {f.rotulo}
      </p>
      <p className="mt-0.5 tabular-nums text-slate-600">
        {inteiro(f.valor)} · {percentual(f.pct)}
      </p>
    </div>
  )
}

/**
 * Rosca de participação: os maiores itens com fatia própria e o resto em "Outros".
 * A legenda ao lado é a leitura exata (rótulo, quantidade e percentual); passar o mouse na fatia ou no
 * item da legenda destaca os dois.
 */
export function GraficoRosca({
  titulo,
  subtitulo,
  itens,
  top = 5,
  semFatia,
  unidade = 'convênios',
  vazio = 'Sem dados.',
  nota,
}: Props) {
  const [ativo, setAtivo] = useState<string | null>(null)
  const fatias = agruparTop(itens, top, semFatia)
  const total = fatias.reduce((s, f) => s + f.valor, 0)

  const forma = (props: PieSectorShapeProps) => {
    const f = props.payload as FatiaRosca | undefined
    const destacada = f !== undefined && f.chave === ativo
    const apagada = ativo !== null && !destacada
    return (
      <Sector
        {...props}
        outerRadius={props.outerRadius + (destacada ? 6 : 0)}
        fill={f?.cor ?? props.fill}
        stroke="#ffffff"
        strokeWidth={2}
        style={{ opacity: apagada ? 0.45 : 1, transition: 'opacity 200ms ease', cursor: 'pointer' }}
      />
    )
  }

  return (
    <section className="cartao flex flex-col" aria-label={titulo}>
      <h2 className="titulo-secao">{titulo}</h2>
      {subtitulo && <p className="subtitulo-secao">{subtitulo}</p>}
      {fatias.length === 0 || total === 0 ? (
        <p className="mt-4 text-sm text-slate-600">{vazio}</p>
      ) : (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row">
          <div className="relative shrink-0" style={{ width: TAMANHO, height: TAMANHO }} aria-hidden="true">
            <PieChart width={TAMANHO} height={TAMANHO}>
              <Pie
                data={fatias}
                dataKey="valor"
                nameKey="rotulo"
                innerRadius="64%"
                outerRadius="92%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={fatias.length > 1 ? 1.5 : 0}
                cornerRadius={4}
                isAnimationActive={ANIMAR}
                animationDuration={900}
                animationEasing="ease-out"
                shape={forma}
                rootTabIndex={-1}
                onMouseEnter={(_, i) => setAtivo(fatias[i]?.chave ?? null)}
                onMouseLeave={() => setAtivo(null)}
              />
              <Tooltip content={<DicaFatia />} wrapperStyle={{ zIndex: 10 }} isAnimationActive={false} />
            </PieChart>
            <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
              <p className="text-3xl font-semibold tracking-tight text-slate-900">
                <NumeroAnimado valor={total} formatar={inteiro} />
              </p>
              <p className="text-xs text-slate-500">{unidade}</p>
            </div>
          </div>
          <ul className="w-full min-w-0 max-w-md flex-1 space-y-0.5 text-[13px]">
            {fatias.map((f, k) => {
              const destacada = f.chave === ativo
              return (
                <li
                  key={f.chave}
                  className={`grid animate-surgir grid-cols-[0.625rem_minmax(0,1fr)_auto_2.75rem] items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                    destacada ? 'bg-marca-50' : ativo !== null ? 'opacity-60' : ''
                  }`}
                  style={{ animationDelay: `${120 + k * 60}ms` }}
                  onMouseEnter={() => setAtivo(f.chave)}
                  onMouseLeave={() => setAtivo(null)}
                >
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.cor }} />
                  <span className={`min-w-0 flex-1 leading-snug ${f.outros ? 'text-slate-500' : 'text-slate-700'}`}>
                    <RotuloQuebravel texto={f.rotulo} />
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">{inteiro(f.valor)}</span>
                  <span className="text-right text-xs tabular-nums text-slate-500">{percentual(f.pct)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {nota && <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">{nota}</p>}
    </section>
  )
}
