import type { ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'

import { ApiErro } from '../api/cliente'
import { useConvenio, useConveniosMunicipio } from '../api/hooks'
import type { DetalheConvenio, LinhaConvenio } from '../api/tipos'
import { CaixaErro, Carregando } from '../componentes/Estados'
import { GraficoSerie } from '../componentes/GraficoSerie'
import { lerFiltros, useBuscaSalva, useMesReferencia } from '../filtros'
import { AUSENTE, data, mesAno, moeda } from '../formato'
import { NOME_RECORTE, ORDEM_EXIBICAO } from '../recortes'
import { exportarPdfCompletoConvenio } from '../relatorioPdf'
import { BlocoContratual, CartoesSaldo, linkDetalhe } from './comum'

// Ícones em linha (traço 1.9), sem biblioteca.
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

const ICONES = {
  voltar: <path d="M15 18l-6-6 6-6" />,
  local: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  fase: <path d="M4 12h4l3-8 4 16 3-8h2" />,
  processo: (
    <>
      <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  codigo: <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />,
  camadas: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5" />,
  alerta: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  vazio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
}

// A API manda a fase em minúsculas e sem acento; valor desconhecido aparece como veio.
const NOME_FASE: Record<string, string> = { vigente: 'Vigente', realinhado: 'Realinhado', historico: 'Histórico' }

/** Um fato do convênio no topo: ícone, rótulo pequeno e valor em branco. */
function Fato({
  icone,
  rotulo,
  className = '',
  children,
}: {
  icone: ReactNode
  rotulo: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`flex gap-3 ${className}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-marca-100 ring-1 ring-white/10">
        <Icone>{icone}</Icone>
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-marca-200">{rotulo}</dt>
        <dd className="mt-0.5 text-sm font-semibold text-white">{children}</dd>
      </div>
    </div>
  )
}

/** "Vigente" ganha o verde dos vigentes; os demais status ficam neutros sobre o fundo escuro. */
function SeloStatus({ status }: { status: string }) {
  const vigente = status.trim().toLowerCase() === 'vigente'
  return (
    <span
      className={`selo ring-1 ${
        vigente ? 'bg-emerald-400/20 text-emerald-50 ring-emerald-300/40' : 'bg-white/10 text-white ring-white/20'
      }`}
    >
      {vigente && <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-300" />}
      {status}
    </span>
  )
}

/** Topo da tela: título, status, objeto e os dados de identificação num card de destaque. */
function Identificacao({
  d,
  buscaVoltar,
  busca,
  conveniosMunicipio,
  veioDoMapa,
}: {
  d: DetalheConvenio
  buscaVoltar: string
  busca: URLSearchParams
  conveniosMunicipio: readonly LinhaConvenio[]
  veioDoMapa: boolean
}) {
  const recortes = ORDEM_EXIBICAO.filter((r) => d.recortes.includes(r))
  return (
    <section
      aria-label="Identificação"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-marca-700 via-marca-800 to-marca-950 p-6 text-white shadow-cartao-alto sm:p-8"
    >
      {/* Brilhos decorativos */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-marca-400/25 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-sky-300/10 blur-3xl"
      />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={`/convenios${buscaVoltar}`}
              className="group inline-flex items-center gap-1 rounded-lg text-sm font-medium text-marca-100 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Icone className="size-4 transition-transform group-hover:-translate-x-0.5">{ICONES.voltar}</Icone>
              Convênios
            </Link>
            {veioDoMapa && (
              <>
                <span aria-hidden="true" className="text-white/25">
                  |
                </span>
                <Link
                  to={`/municipios${buscaVoltar}`}
                  className="group inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-marca-100 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Icone className="size-4 transition-transform group-hover:-translate-x-0.5">{ICONES.voltar}</Icone>
                  <Icone className="size-4 text-marca-200">{ICONES.local}</Icone>
                  Voltar ao mapa
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => void exportarPdfCompletoConvenio(d)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs backdrop-blur-xs transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Icone className="size-4">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="m9 15 3 3 3-3" />
            </Icone>
            Exportar PDF
          </button>
        </div>

        {conveniosMunicipio.length > 1 && (
          <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-marca-200">
              Convênios de {d.municipio} ({conveniosMunicipio.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {conveniosMunicipio.map((c) => {
                const ativo = c.numero_convenio === d.numero_convenio
                return (
                  <Link
                    key={c.numero_convenio}
                    to={linkDetalhe(c.numero_convenio, d.municipio, busca)}
                    state={veioDoMapa ? { veioDoMapa: true } : undefined}
                    aria-current={ativo ? 'page' : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      ativo
                        ? 'bg-white text-marca-900 shadow-2xs'
                        : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <span className="tabular-nums">{c.numero_convenio}</span>
                    {c.status && (
                      <span className={`text-[10px] font-normal ${ativo ? 'text-marca-700' : 'text-marca-200'}`}>
                        · {c.status}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Convênio <span className="tabular-nums">{d.numero_convenio}</span>
            {' '}
            <span className="text-marca-300">·</span>{' '}
            <span className="inline-flex items-center gap-1.5">
              <Icone className="size-5 text-marca-200 sm:size-6">{ICONES.local}</Icone>
              {d.municipio}
            </span>
          </h1>
          {(d.status || d.situacao_vigencia) && (
            <div className="flex flex-wrap gap-2 pt-1.5">
              {d.status && <SeloStatus status={d.status} />}
              {d.situacao_vigencia && (
                <span className="selo bg-white/10 text-marca-50 ring-1 ring-white/20">{d.situacao_vigencia}</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-marca-200">Objeto</p>
          <p className="mt-1 text-base leading-relaxed text-marca-50">{d.objeto ?? AUSENTE}</p>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          <Fato icone={ICONES.calendario} rotulo="Fim da vigência">
            <span className="tabular-nums">{data(d.vigencia_final)}</span>
          </Fato>
          <Fato icone={ICONES.fase} rotulo="Fase">
            {NOME_FASE[d.fase] ?? d.fase}
          </Fato>
          <Fato icone={ICONES.processo} rotulo="Processo celebração">
            <span className="tabular-nums">{d.processo_celebracao ?? AUSENTE}</span>
          </Fato>
          <Fato icone={ICONES.codigo} rotulo="Código SEOBRAS">
            <span className="tabular-nums">{d.codigo_seobras ?? AUSENTE}</span>
          </Fato>
          <Fato icone={ICONES.codigo} rotulo="Código SEIOP">
            <span className="tabular-nums">{d.codigo_seiop ?? AUSENTE}</span>
          </Fato>
          <Fato icone={ICONES.camadas} rotulo="Recortes" className="sm:col-span-2">
            {recortes.length === 0 ? (
              AUSENTE
            ) : (
              <ul aria-label="Recortes" className="mt-0.5 flex flex-wrap gap-1.5">
                {recortes.map((r) => (
                  <li
                    key={r}
                    className={`selo ring-1 ${
                      r === '31'
                        ? 'bg-emerald-400/20 text-emerald-50 ring-emerald-300/40'
                        : 'bg-white/10 text-white ring-white/20'
                    }`}
                  >
                    {NOME_RECORTE[r]}
                  </li>
                ))}
              </ul>
            )}
          </Fato>
        </dl>
      </div>
    </section>
  )
}

function Compartilhado({ d, busca }: { d: DetalheConvenio; busca: URLSearchParams }) {
  return (
    <section
      aria-label="Código compartilhado"
      className="flex animate-surgir gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-950 shadow-cartao"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
        <Icone className="size-5">{ICONES.alerta}</Icone>
      </span>
      <div className="min-w-0">
        <p className="font-semibold">Código compartilhado com outros convênios</p>
        <p className="mt-0.5 text-amber-900">
          Um código SIAFE deste convênio também é usado por:
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {d.compartilhado_com.map((c) => (
            <li key={`${c.numero_convenio}|${c.municipio}|${c.codigo}`} className="flex items-center gap-1.5">
              <Link
                to={linkDetalhe(c.numero_convenio, c.municipio, busca)}
                className="rounded-full border border-amber-300 bg-white px-3 py-1 font-medium text-amber-900 transition-colors hover:border-amber-400 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              >
                {c.numero_convenio} · {c.municipio}
              </Link>
              <span className="text-xs text-amber-800">(código {c.codigo})</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Cabeçalho de seção: título, subtítulo e, à direita, um selo opcional (ex.: o mês). */
function CabecalhoSecao({ titulo, subtitulo, selo }: { titulo: string; subtitulo?: string; selo?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="titulo-secao">{titulo}</h2>
        {subtitulo && <p className="subtitulo-secao">{subtitulo}</p>}
      </div>
      {selo}
    </div>
  )
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-4 text-sm text-slate-600">
      <Icone className="size-5 text-slate-400">{ICONES.vazio}</Icone>
      <span>{children}</span>
    </p>
  )
}

export function TelaDetalhe() {
  const [busca] = useSearchParams()
  const { state } = useLocation()
  const veioDoMapa = Boolean((state as { veioDoMapa?: boolean } | null)?.veioDoMapa)
  const buscaSalva = useBuscaSalva()
  const numeroUrl = busca.get('numero') ?? ''
  const municipio = busca.get('municipio') ?? ''
  const filtros = lerFiltros(busca)
  const ref = useMesReferencia(filtros.mes)
  const conveniosMun = useConveniosMunicipio(municipio, filtros.recorte, ref.mes, { enabled: ref.resolvido })
  const numero = numeroUrl || conveniosMun.data?.[0]?.numero_convenio || ''
  const consulta = useConvenio(numero, municipio, ref.mes, { enabled: ref.resolvido && Boolean(numero) })
  const d = consulta.data

  if (!numeroUrl && conveniosMun.isSuccess && (conveniosMun.data?.length ?? 0) === 0) {
    return (
      <section className="cartao flex flex-col items-start gap-1">
        <span className="mb-2 grid size-11 place-items-center rounded-xl bg-marca-50 text-marca-600">
          <Icone className="size-5">{ICONES.vazio}</Icone>
        </span>
        <h1 className="titulo-tela">Convênio não encontrado</h1>
        <p className="text-sm text-slate-600">Não há convênios cadastrados em {municipio}.</p>
        <Link to={`/convenios${buscaSalva}`} className="botao-secundario mt-3 inline-block">
          Ir para a lista de convênios
        </Link>
      </section>
    )
  }

  if (consulta.isError) {
    const erro = consulta.error
    if (erro instanceof ApiErro && erro.status === 404) {
      return (
        <section className="cartao flex flex-col items-start gap-1">
          <span className="mb-2 grid size-11 place-items-center rounded-xl bg-marca-50 text-marca-600">
            <Icone className="size-5">{ICONES.vazio}</Icone>
          </span>
          <h1 className="titulo-tela">Convênio não encontrado</h1>
          <p className="text-sm text-slate-600">
            Não há convênio {numero} em {municipio}.
          </p>
          <Link to={`/convenios${buscaSalva}`} className="botao-secundario mt-3 inline-block">
            Ir para a lista de convênios
          </Link>
        </section>
      )
    }
    return (
      <div className="space-y-3">
        <CaixaErro erro={erro} onTentar={() => void consulta.refetch()} titulo="Não foi possível abrir o convênio" />
        <Link to={`/convenios${buscaSalva}`} className="botao-link">
          Ir para a lista de convênios
        </Link>
      </div>
    )
  }
  if (!d) return <Carregando />

  const { ano, mes } = d.referencia
  const anterior = mes === 1 ? mesAno(ano - 1, 12) : mesAno(ano, mes - 1)

  return (
    <div className="space-y-8">
      <Identificacao
        d={d}
        buscaVoltar={buscaSalva}
        busca={busca}
        conveniosMunicipio={conveniosMun.data ?? []}
        veioDoMapa={veioDoMapa}
      />

      {d.codigo_compartilhado && <Compartilhado d={d} busca={busca} />}

      <section aria-label="Saldos do mês" className="space-y-4">
        <CabecalhoSecao
          titulo="Saldos SIAFE"
          subtitulo={`Posição do mês, comparada a ${anterior}.`}
          selo={
            <span className="selo bg-marca-50 py-1 text-marca-700 ring-1 ring-marca-100">
              <Icone className="size-3.5">{ICONES.calendario}</Icone>
              {mesAno(ano, mes)}
            </span>
          }
        />
        {!d.saldos && <Aviso>O SIAFE não tem dados de {mesAno(ano, mes)}.</Aviso>}
        <CartoesSaldo saldos={d.saldos} anterior={d.mes_anterior} mesAnterior={anterior} />
      </section>

      <section className="space-y-4">
        <CabecalhoSecao
          titulo="Valores contratuais"
          subtitulo="Da planilha de convênios, um bloco por recorte em que o convênio aparece."
        />
        {d.contratual.length === 0 ? (
          <Aviso>
            Não há valores contratuais para este convênio: ele não está nos recortes Vigentes nem Primeiro
            realinhamento.
          </Aviso>
        ) : (
          <div className={`grade-surgir grid gap-5 ${d.contratual.length > 1 ? 'lg:grid-cols-2' : ''}`}>
            {d.contratual.map((c) => (
              <BlocoContratual
                key={c.recorte}
                titulo={`Valores contratuais · ${NOME_RECORTE[c.recorte]}`}
                recorte={NOME_RECORTE[c.recorte]}
                destaque={c.recorte === '31'}
                valores={c}
              />
            ))}
          </div>
        )}
      </section>

      <GraficoSerie titulo="Saldos SIAFE do convênio por mês" pontos={d.serie} />

      {d.tomada_contas && (
        <section aria-label="Tomada de Contas" className="space-y-4">
          <CabecalhoSecao
            titulo="Tomada de Contas"
            subtitulo="Registro de apuração administrativa vinculado a este convênio."
          />
          <div className="cartao grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Valor SIAFE</p>
              <p className="mt-1 font-semibold tabular-nums text-amber-800">{moeda(d.tomada_contas.valor_siafe)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Processo SEI / Adm.</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{d.tomada_contas.processo_sei ?? AUSENTE}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Parecer da Comissão</p>
              <p className="mt-1 text-sm text-slate-700">{d.tomada_contas.parecer_comissao ?? AUSENTE}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Status</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{d.tomada_contas.status ?? AUSENTE}</p>
            </div>
          </div>
        </section>
      )}

      {d.prestacao_contas && d.prestacao_contas.length > 0 && (
        <section aria-label="Prestação de Contas" className="space-y-4">
          <CabecalhoSecao
            titulo="Prestação de Contas · Parcelas"
            subtitulo={`${d.prestacao_contas.length} parcela(s) registrada(s) na planilha de execução.`}
          />
          <div className="cartao overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Parcela</th>
                  <th className="px-4 py-3 text-right">Valor Repasse</th>
                  <th className="px-4 py-3 text-right">Valor Executado</th>
                  <th className="px-4 py-3">Processo</th>
                  <th className="px-4 py-3">Baixa Apresentação</th>
                  <th className="px-4 py-3">Baixa Aprovação</th>
                  <th className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.prestacao_contas.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-medium tabular-nums">{p.parcela ?? AUSENTE}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{moeda(p.valor_repasse)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{moeda(p.valor_executado)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{p.processo ?? AUSENTE}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{p.baixa_apresentacao ?? AUSENTE}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{p.baixa_aprovacao ?? AUSENTE}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{p.situacao ?? AUSENTE}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
