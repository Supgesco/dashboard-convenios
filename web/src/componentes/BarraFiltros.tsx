import { motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { useContagemRecortes, useOpcoesMunicipios } from '../api/hooks'
import type { Recorte } from '../api/tipos'
import { useFiltros, useMesReferencia } from '../filtros'
import { inteiro } from '../formato'
import { NOME_RECORTE, ORDEM_EXIBICAO, rotuloRecorte } from '../recortes'

// Ícones pequenos em linha (16px), no mesmo traço dos do menu.
function Icone({ children, className = 'size-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

const ICONE_LOCAL = (
  <Icone className="size-4 text-slate-400">
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icone>
)

const ICONE_CALENDARIO = (
  <Icone className="size-4 text-slate-400">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icone>
)

/** Seletor segmentado dos recortes: o fundo do ativo desliza entre as opções. */
function SeletorRecorte() {
  const { filtros, mudar } = useFiltros()
  const contagem = useContagemRecortes()
  return (
    <div
      role="group"
      aria-label="Recorte"
      className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100/80 p-1 sm:flex sm:w-auto"
    >
      {ORDEM_EXIBICAO.map((r) => {
        const ativo = filtros.recorte === r
        const qtd = contagem[r]
        return (
          <button
            key={r}
            type="button"
            aria-pressed={ativo}
            aria-label={rotuloRecorte(r, qtd)}
            onClick={() => mudar({ recorte: r })}
            className={`relative flex flex-col items-center justify-center gap-x-2 gap-y-0.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-marca-600 sm:flex-row sm:py-2 ${
              ativo ? 'text-marca-800' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {ativo && (
              <motion.span
                layoutId="recorte-ativo"
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-white shadow-cartao ring-1 ring-slate-200/70"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative text-center leading-tight sm:whitespace-nowrap">{NOME_RECORTE[r]}</span>
            {qtd !== null && qtd !== undefined && (
              <span
                aria-hidden="true"
                className={`relative rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums transition-colors ${
                  ativo ? 'bg-marca-100 text-marca-700' : 'bg-white/80 text-slate-500'
                }`}
              >
                {inteiro(qtd)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const PILULA =
  'inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-colors hover:border-marca-200 hover:bg-marca-50/40'

/** Botão que abre a lista de municípios do recorte (busca + caixas de seleção), num popover próprio. */
function SeletorMunicipios({
  recorte,
  selecionados,
  onMudar,
}: {
  recorte: Recorte
  selecionados: readonly string[]
  onMudar: (m: string[]) => void
}) {
  const opcoes = useOpcoesMunicipios(recorte)
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const raiz = useRef<HTMLDivElement>(null)
  const idBusca = useId()
  const idPainel = useId()
  const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const visiveis = (opcoes.data ?? []).filter((m) => normal(m).includes(normal(busca)))

  // Fecha com clique fora ou Esc.
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  const alternar = (m: string) =>
    onMudar(selecionados.includes(m) ? selecionados.filter((s) => s !== m) : [...selecionados, m])
  const n = selecionados.length

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={idPainel}
        onClick={() => setAberto((a) => !a)}
        className={`${PILULA} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600 ${
          aberto || n ? 'border-marca-200 bg-marca-50/50' : ''
        }`}
      >
        {ICONE_LOCAL}
        <span className="text-slate-500">Municípios</span>
        <span className="font-semibold text-slate-900">{n ? `${n} selecionado${n === 1 ? '' : 's'}` : 'Todos'}</span>
        <Icone className={`size-3.5 text-slate-400 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </Icone>
      </button>
      {aberto && (
        <motion.div
          id={idPainel}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="absolute left-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-left overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-cartao-alto"
        >
          <div className="border-b border-slate-100 p-2">
            <label htmlFor={idBusca} className="sr-only">
              Buscar município
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center">
                <Icone className="size-4 text-slate-400">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m20 20-4-4" />
                </Icone>
              </span>
              <input
                id={idBusca}
                autoFocus
                className="campo w-full bg-slate-50 pl-9"
                placeholder="Buscar município"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          {opcoes.isPending ? (
            <p className="p-4 text-sm text-slate-500">Carregando…</p>
          ) : opcoes.isError ? (
            <p className="p-4 text-sm text-red-800">Não foi possível carregar os municípios.</p>
          ) : (
            <ul className="max-h-64 overflow-auto p-1.5" aria-label="Municípios do recorte">
              {visiveis.map((m) => {
                const marcado = selecionados.includes(m)
                return (
                  <li key={m}>
                    <label
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-marca-50 ${
                        marcado ? 'font-medium text-marca-800' : 'text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-marca-600"
                        checked={marcado}
                        onChange={() => alternar(m)}
                      />
                      {m}
                    </label>
                  </li>
                )
              })}
              {visiveis.length === 0 && <li className="p-2.5 text-sm text-slate-500">Nenhum município.</li>}
            </ul>
          )}
          {n > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
              <span className="tabular-nums">
                {n} selecionado{n === 1 ? '' : 's'}
              </span>
              <button type="button" className="botao-link text-xs" onClick={() => onMudar([])}>
                Limpar seleção
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

function SeletorMes() {
  const { filtros, mudar } = useFiltros()
  const ref = useMesReferencia(filtros.mes)
  const valorMes = ref.mes ? `${ref.mes.ano}-${String(ref.mes.mes).padStart(2, '0')}` : ''
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={`${PILULA} focus-within:border-marca-500 focus-within:ring-2 focus-within:ring-marca-100`}>
        {ICONE_CALENDARIO}
        <label htmlFor="mes-referencia" className="text-slate-500">
          Mês<span className="sr-only"> de referência</span>
        </label>
        <input
          id="mes-referencia"
          type="month"
          className="min-w-0 bg-transparent font-semibold text-slate-900 focus:outline-none"
          value={valorMes}
          min="2023-01"
          onChange={(e) => {
            const [a, m] = e.target.value.split('-').map(Number)
            mudar({ mes: a && m ? { ano: a, mes: m } : null })
          }}
        />
      </div>
      {ref.daUrl ? (
        <button
          type="button"
          onClick={() => mudar({ mes: null })}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-marca-700 transition-colors hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-marca-600"
        >
          <Icone className="size-3.5">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </Icone>
          Voltar ao último mês
        </button>
      ) : (
        ref.mes && (
          <span className="selo bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
            último disponível
          </span>
        )
      )}
    </div>
  )
}

/**
 * Em tela larga, diz se a barra já saiu inteira da tela (rolando para baixo). Enquanto ela está fixa, a vaga
 * original guarda a altura medida, para o conteúdo não pular.
 */
function useFixarAoSair() {
  const vaga = useRef<HTMLDivElement>(null)
  const [fixo, setFixo] = useState(false)
  const [altura, setAltura] = useState(0)

  useEffect(() => {
    const larga = window.matchMedia?.('(min-width: 64rem)')
    const avaliar = () => {
      const r = vaga.current?.getBoundingClientRect()
      // Solta, a vaga tem a altura da própria barra; fixa, guarda a mesma altura (então não muda).
      if (r) setAltura(r.height)
      setFixo(Boolean(larga?.matches && r && r.bottom < 0))
    }
    avaliar()
    window.addEventListener('scroll', avaliar, { passive: true })
    window.addEventListener('resize', avaliar)
    return () => {
      window.removeEventListener('scroll', avaliar)
      window.removeEventListener('resize', avaliar)
    }
  }, [])

  return { vaga, fixo, altura }
}

/**
 * Barra de filtros de Municípios e Convênios: um card compacto com o recorte, os municípios e o mês (os
 * municípios escolhidos viram chips numa segunda linha). Em tela larga, quando o card sai da tela ao rolar,
 * a barra passa a ficar presa no topo como um cabeçalho de largura total, e volta ao card ao subir.
 */
export function BarraFiltros() {
  const { filtros, mudar } = useFiltros()
  const selecionados = filtros.municipios
  const { vaga, fixo, altura } = useFixarAoSair()

  return (
    <div ref={vaga} style={fixo ? { height: altura } : undefined}>
      <section
        aria-label="Filtros"
        className={
          fixo
            ? 'fixed inset-x-0 top-0 z-30 animate-descer border-b border-slate-200/80 bg-white/90 shadow-[0_8px_24px_-14px_rgb(15_23_42/0.3)] backdrop-blur-md lg:left-60'
            : 'relative z-20 animate-surgir rounded-2xl border border-slate-200/60 bg-white p-2 shadow-cartao'
        }
      >
        <div className={fixo ? 'mx-auto max-w-7xl px-10 py-2' : ''}>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-3">
            <SeletorRecorte />
            <div className="flex flex-wrap items-center gap-2">
              <SeletorMunicipios
                recorte={filtros.recorte}
                selecionados={selecionados}
                onMudar={(municipios) => mudar({ municipios })}
              />
              <SeletorMes />
            </div>
          </div>
          {selecionados.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-1 pt-2">
              {selecionados.map((m) => (
                <span
                  key={m}
                  className="inline-flex animate-surgir items-center gap-1 rounded-full border border-marca-100 bg-marca-50 py-0.5 pr-1 pl-2.5 text-xs font-medium text-marca-800"
                >
                  {m}
                  <button
                    type="button"
                    aria-label={`Remover ${m}`}
                    onClick={() => mudar({ municipios: selecionados.filter((s) => s !== m) })}
                    className="grid size-5 place-items-center rounded-full text-marca-500 transition-colors hover:bg-marca-100 hover:text-marca-800"
                  >
                    <Icone className="size-3">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </Icone>
                  </button>
                </span>
              ))}
              <button type="button" className="botao-link ml-1 text-xs" onClick={() => mudar({ municipios: [] })}>
                Limpar municípios
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
