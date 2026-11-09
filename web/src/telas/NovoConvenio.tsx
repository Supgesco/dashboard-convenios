import { useMemo, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { useCriarConvenio, useEditarConvenio, useMunicipiosRecorte } from '../api/hooks'
import type { LinhaConvenio, Recorte } from '../api/tipos'
import { TabelaPaginada, type Coluna } from '../componentes/TabelaPaginada'
import { AUSENTE, moeda, percentual } from '../formato'
import { linkDetalhe } from './comum'

let exibirNovoConvenioGlobal = false
const ouvintesNovoConvenio = new Set<() => void>()

export function definirExibirNovoConvenio(valor: boolean) {
  exibirNovoConvenioGlobal = valor
  ouvintesNovoConvenio.forEach((fn) => fn())
}

export function useExibirNovoConvenio(): [boolean, (v: boolean) => void] {
  const aberto = useSyncExternalStore(
    (cb) => {
      ouvintesNovoConvenio.add(cb)
      return () => ouvintesNovoConvenio.delete(cb)
    },
    () => exibirNovoConvenioGlobal,
  )
  return [aberto, definirExibirNovoConvenio]
}

// Notificação global de convênio recém-adicionado (some automaticamente após alguns minutos).
const DURACAO_NOTIFICACAO_MS = 2 * 60 * 1000 // 2 minutos
let convenioRecemAdicionadoGlobal: LinhaConvenio | null = null
let timerNotificacao: ReturnType<typeof setTimeout> | null = null
const ouvintesRecemAdicionado = new Set<() => void>()

export function registrarConvenioRecemAdicionado(convenio: LinhaConvenio | null) {
  convenioRecemAdicionadoGlobal = convenio
  if (timerNotificacao) {
    clearTimeout(timerNotificacao)
    timerNotificacao = null
  }
  if (convenio) {
    timerNotificacao = setTimeout(() => {
      convenioRecemAdicionadoGlobal = null
      timerNotificacao = null
      ouvintesRecemAdicionado.forEach((fn) => fn())
    }, DURACAO_NOTIFICACAO_MS)
  }
  ouvintesRecemAdicionado.forEach((fn) => fn())
}

export function useConvenioRecemAdicionado(): [LinhaConvenio | null, (c: LinhaConvenio | null) => void] {
  const atual = useSyncExternalStore(
    (cb) => {
      ouvintesRecemAdicionado.add(cb)
      return () => ouvintesRecemAdicionado.delete(cb)
    },
    () => convenioRecemAdicionadoGlobal,
  )
  return [atual, registrarConvenioRecemAdicionado]
}

export const OPCOES_SITUACAO = [
  'vigente',
  'não vigente',
  'vencido',
  'a vencer',
  'sob realinhamento',
] as const

function normalizarPreviewSeobras(bruto: string): string | null {
  const limpo = bruto.trim()
  if (!limpo) return null
  const m = limpo.match(/(?:^|\D)(2[1-6]\d{4})(?:\D|$)/)
  if (m) return m[1]
  const digitos = limpo.replace(/\D/g, '')
  if (digitos.length >= 6) return digitos.slice(0, 6)
  return digitos || null
}

function normalizarPreviewSeiop(bruto: string): string | null {
  const limpo = bruto.trim()
  if (!limpo) return null
  const digitos = limpo.replace(/\D/g, '')
  if (!digitos) return null
  return digitos.length <= 6 ? digitos.padStart(6, '0') : digitos.slice(0, 6)
}

function normalizarPreviewNumero(bruto: string): string {
  const limpo = bruto.trim()
  const m = limpo.match(/^(\d{1,4})\s*[/\-]\s*(\d{4})$/)
  if (m) return `${m[1].padStart(3, '0')}/${m[2]}`
  return limpo
}

const COLUNAS_CRIADOS: Coluna<LinhaConvenio>[] = [
  { campo: 'numero_convenio', rotulo: 'Número', fixa: true, valor: (i) => i.numero_convenio },
  { campo: 'municipio', rotulo: 'Município', valor: (i) => i.municipio },
  { campo: 'status', rotulo: 'Situação', valor: (i) => i.status ?? AUSENTE },
  { campo: 'codigo_seobras', rotulo: 'SEOBRAS', valor: (i) => i.codigo_seobras ?? AUSENTE },
  { campo: 'codigo_seiop', rotulo: 'SEIOP', valor: (i) => i.codigo_seiop ?? AUSENTE },
  { campo: 'a_pagar', rotulo: 'A pagar', numerica: true, valor: (i) => moeda(i.a_pagar) },
  { campo: 'a_comprovar', rotulo: 'A comprovar', numerica: true, valor: (i) => moeda(i.a_comprovar) },
  { campo: 'valor_total', rotulo: 'Valor total', numerica: true, valor: (i) => moeda(i.valor_total) },
  { campo: 'repasse_estado', rotulo: 'Repasse Estado', numerica: true, valor: (i) => moeda(i.repasse_estado) },
  { campo: 'investido_estado', rotulo: 'Investido', numerica: true, valor: (i) => moeda(i.investido_estado) },
  {
    campo: 'execucao_pct',
    rotulo: '% Execução',
    numerica: true,
    somenteLeitura: true,
    valor: (i) => percentual(i.execucao_pct),
  },
]

export function FormularioNovoConvenio({
  onCriado,
  onVoltarLista,
}: {
  onCriado?: (novo: LinhaConvenio) => void
  onVoltarLista?: () => void
}) {
  const navegar = useNavigate()
  const criar = useCriarConvenio()
  const muns342 = useMunicipiosRecorte('342')
  const listaMunicipios = useMemo(
    () => (muns342.data ?? []).map((m) => m.municipio).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [muns342.data],
  )

  const [numeroConvenio, setNumeroConvenio] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [recortes, setRecortes] = useState<Recorte[]>(['31', '89', '342'])
  const [codigoSeobras, setCodigoSeobras] = useState('')
  const [codigoSeiop, setCodigoSeiop] = useState('')
  const [situacao, setSituacao] = useState<string>('vigente')
  const [vigenciaInicio, setVigenciaInicio] = useState('')
  const [vigenciaFinal, setVigenciaFinal] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [termoRealinhamento, setTermoRealinhamento] = useState<'1°' | '2°' | '3°'>('1°')
  const [processoSei, setProcessoSei] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [objeto, setObjeto] = useState('')

  const [aPagar, setAPagar] = useState('0')
  const [aComprovar, setAComprovar] = useState('0')
  const [aAprovar, setAAprovar] = useState('0')
  const [aprovados, setAprovados] = useState('0')

  const [valorTotal, setValorTotal] = useState('0')
  const [repasseEstado, setRepasseEstado] = useState('0')
  const [contrapartida, setContrapartida] = useState('0')
  const [investidoEstado, setInvestidoEstado] = useState('0')
  const [aRepassarManual, setARepassarManual] = useState('')

  const [incluirPrestacao, setIncluirPrestacao] = useState(false)
  const [parcela, setParcela] = useState('1')
  const [baixaApresentacao, setBaixaApresentacao] = useState('Pendente')
  const [baixaAprovacao, setBaixaAprovacao] = useState('Em análise')

  const [incluirTomada, setIncluirTomada] = useState(false)
  const [parecerComissao, setParecerComissao] = useState('Em instrução')

  const [ultimoCriado, setUltimoCriado] = useState<LinhaConvenio | null>(null)
  const [erroForm, setErroForm] = useState<string | null>(null)

  const vtNum = Number(valorTotal) || 0
  const repNum = Number(repasseEstado) || 0
  const invNum = Number(investidoEstado) || 0
  const aRepassarCalculado = aRepassarManual !== '' ? Number(aRepassarManual) || 0 : Math.max(0, repNum - invNum)
  const execucaoPct = repNum > 0 ? (100 * invNum) / repNum : 0
  const investidoSobreTotalPct = vtNum > 0 ? (100 * invNum) / vtNum : 0

  const previewSeobras = normalizarPreviewSeobras(codigoSeobras)
  const previewSeiop = normalizarPreviewSeiop(codigoSeiop)
  const previewNumero = normalizarPreviewNumero(numeroConvenio)

  function alternarRecorte(r: Recorte) {
    if (r === '342') return // 342 sempre incluído (base geral)
    setRecortes((atual) => (atual.includes(r) ? atual.filter((x) => x !== r) : [...atual, r]))
  }

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setErroForm(null)
    if (!numeroConvenio.trim()) {
      setErroForm('Informe o número do convênio (ex: 015/2026).')
      return
    }
    if (!municipio.trim()) {
      setErroForm('Informe o município do convênio.')
      return
    }

    const dataFinalAssociada =
      situacao === 'vencido' || situacao === 'a vencer'
        ? dataVencimento || null
        : situacao === 'vigente'
          ? vigenciaFinal || null
          : null

    try {
      const novo = await criar.mutateAsync({
        numero_convenio: numeroConvenio.trim(),
        municipio: municipio.trim(),
        recortes,
        status: situacao,
        situacao_vigencia: situacao,
        vigencia_inicio: situacao === 'vigente' ? vigenciaInicio || null : null,
        vigencia_final: dataFinalAssociada,
        termo_realinhamento: situacao === 'sob realinhamento' ? termoRealinhamento : null,
        objeto: objeto || null,
        codigo_seobras: codigoSeobras || null,
        codigo_seiop: codigoSeiop || null,
        cnpj: cnpj || null,
        processo_sei: processoSei || null,
        a_pagar: Number(aPagar) || 0,
        a_comprovar: Number(aComprovar) || 0,
        a_aprovar: Number(aAprovar) || 0,
        aprovados: Number(aprovados) || 0,
        valor_total: vtNum,
        repasse_estado: repNum,
        contrapartida: Number(contrapartida) || 0,
        investido_estado: invNum,
        a_repassar: aRepassarCalculado,
        incluir_prestacao: incluirPrestacao,
        parcela: Number(parcela) || 1,
        baixa_apresentacao: baixaApresentacao,
        baixa_aprovacao: baixaAprovacao,
        incluir_tomada: incluirTomada,
        parecer_comissao: parecerComissao,
      })
      setUltimoCriado(novo)
      registrarConvenioRecemAdicionado(novo)
      onCriado?.(novo)
      setNumeroConvenio('')
      setCodigoSeobras('')
      setCodigoSeiop('')
      setObjeto('')
      setProcessoSei('')
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : 'Erro ao salvar o convênio.')
    }
  }

  return (
    <div className="space-y-6">
      {ultimoCriado && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/90 px-5 py-4 text-sm text-emerald-950 shadow-xs"
        >
          <div>
            <p className="font-semibold">
              Convênio {ultimoCriado.numero_convenio} ({ultimoCriado.municipio}) cadastrado com sucesso!
            </p>
            <p className="mt-0.5 text-xs text-emerald-800">
              Códigos normalizados — SEOBRAS: <span className="font-mono font-semibold">{ultimoCriado.codigo_seobras ?? '—'}</span> · SEIOP:{' '}
              <span className="font-mono font-semibold">{ultimoCriado.codigo_seiop ?? '—'}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navegar(linkDetalhe(ultimoCriado.numero_convenio, ultimoCriado.municipio, new URLSearchParams()))}
              className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-800"
            >
              Abrir detalhe do convênio
            </button>
            <button
              type="button"
              onClick={() => (onVoltarLista ? onVoltarLista() : navegar('/convenios'))}
              className="rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              Ver na lista de Convênios
            </button>
          </div>
        </div>
      )}

      {erroForm && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {erroForm}
        </div>
      )}

      <form onSubmit={submeter} className="space-y-6">
        {/* Bloco 1: Identificação e Códigos SIAFE */}
        <section className="cartao space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="titulo-secao">1. Identificação e Códigos SIAFE (SEOBRAS / SEIOP)</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Os códigos SEOBRAS (6 dígitos iniciados por 21–26) e SEIOP (6 dígitos com zeros à esquerda) são higienizados e padronizados automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="nc-numero" className="text-xs font-semibold text-slate-700">
                Número do Convênio *
              </label>
              <input
                id="nc-numero"
                type="text"
                required
                placeholder="Ex: 015/2026"
                value={numeroConvenio}
                onChange={(e) => setNumeroConvenio(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
              />
              {numeroConvenio && (
                <span className="text-[11px] text-slate-500">
                  Padrão normalizado: <strong className="font-mono text-slate-700">{previewNumero}</strong>
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="nc-municipio" className="text-xs font-semibold text-slate-700">
                Município *
              </label>
              <input
                id="nc-municipio"
                type="text"
                required
                list="lista-municipios-rj"
                placeholder="Ex: São Fidélis"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
              />
              <datalist id="lista-municipios-rj">
                {listaMunicipios.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="nc-seobras" className="text-xs font-semibold text-slate-700">
                Código SIAFE — SEOBRAS
              </label>
              <input
                id="nc-seobras"
                type="text"
                placeholder="Ex: 240010 ou CV240010"
                value={codigoSeobras}
                onChange={(e) => setCodigoSeobras(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
              />
              <span className="text-[11px] text-slate-500">
                Normalizado: <strong className="font-mono text-marca-700">{previewSeobras ?? '—'}</strong>
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="nc-seiop" className="text-xs font-semibold text-slate-700">
                Código SIAFE — SEIOP
              </label>
              <input
                id="nc-seiop"
                type="text"
                placeholder="Ex: 109 ou 000109"
                value={codigoSeiop}
                onChange={(e) => setCodigoSeiop(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
              />
              <span className="text-[11px] text-slate-500">
                Normalizado: <strong className="font-mono text-marca-700">{previewSeiop ?? '—'}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="nc-situacao" className="text-xs font-semibold text-slate-700">
                Situação
              </label>
              <select
                id="nc-situacao"
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
              >
                {OPCOES_SITUACAO.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            {situacao === 'vigente' && (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="nc-vigencia-inicio" className="text-xs font-semibold text-slate-700">
                    Início de Vigência
                  </label>
                  <input
                    id="nc-vigencia-inicio"
                    type="date"
                    value={vigenciaInicio}
                    onChange={(e) => setVigenciaInicio(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="nc-vigencia-final" className="text-xs font-semibold text-slate-700">
                    Fim da Vigência
                  </label>
                  <input
                    id="nc-vigencia-final"
                    type="date"
                    value={vigenciaFinal}
                    onChange={(e) => setVigenciaFinal(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                  />
                </div>
              </>
            )}

            {(situacao === 'vencido' || situacao === 'a vencer') && (
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-data-vencimento" className="text-xs font-semibold text-slate-700">
                  Data de Vencimento
                </label>
                <input
                  id="nc-data-vencimento"
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                />
              </div>
            )}

            {situacao === 'sob realinhamento' && (
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-termo-realinhamento" className="text-xs font-semibold text-slate-700">
                  Realinhamento (1°, 2° ou 3°)
                </label>
                <select
                  id="nc-termo-realinhamento"
                  value={termoRealinhamento}
                  onChange={(e) => setTermoRealinhamento(e.target.value as '1°' | '2°' | '3°')}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                >
                  <option value="1°">1°</option>
                  <option value="2°">2°</option>
                  <option value="3°">3°</option>
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="nc-processo" className="text-xs font-semibold text-slate-700">
                Processo SEI
              </label>
              <input
                id="nc-processo"
                type="text"
                placeholder="Ex: SEI-170026/001234/2026"
                value={processoSei}
                onChange={(e) => setProcessoSei(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="nc-cnpj" className="text-xs font-semibold text-slate-700">
                CNPJ do Município / Ente
              </label>
              <input
                id="nc-cnpj"
                type="text"
                placeholder="Ex: 29.138.328/0001-50"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-700">Recortes em que o convênio entra</span>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={recortes.includes('31')}
                    onChange={() => alternarRecorte('31')}
                    className="size-4 rounded border-slate-300 text-marca-600 focus:ring-marca-600"
                  />
                  31 (Vigentes)
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={recortes.includes('89')}
                    onChange={() => alternarRecorte('89')}
                    className="size-4 rounded border-slate-300 text-marca-600 focus:ring-marca-600"
                  />
                  89 (1º Realinhamento)
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    className="size-4 rounded border-slate-300 text-marca-600"
                  />
                  342 (Base Geral)
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="nc-objeto" className="text-xs font-semibold text-slate-700">
                Objeto do Convênio
              </label>
              <textarea
                id="nc-objeto"
                rows={2}
                placeholder="Descrição da obra, pavimentação, drenagem ou intervenção objeto do convênio..."
                value={objeto}
                onChange={(e) => setObjeto(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
              />
            </div>
          </div>
        </section>

        {/* Bloco 2: Saldos SIAFE e Valores Contratuais */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="cartao space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="titulo-secao">2. Saldos Contábeis SIAFE (R$)</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Saldos das quatro contas do SIAFE para este convênio no mês de referência.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-a-pagar" className="text-xs font-semibold text-slate-700">
                  A pagar (R$)
                </label>
                <input
                  id="nc-a-pagar"
                  type="number"
                  step="any"
                  value={aPagar}
                  onChange={(e) => setAPagar(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-a-comprovar" className="text-xs font-semibold text-slate-700">
                  A comprovar (R$)
                </label>
                <input
                  id="nc-a-comprovar"
                  type="number"
                  step="any"
                  value={aComprovar}
                  onChange={(e) => setAComprovar(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-a-aprovar" className="text-xs font-semibold text-slate-700">
                  A aprovar (R$)
                </label>
                <input
                  id="nc-a-aprovar"
                  type="number"
                  step="any"
                  value={aAprovar}
                  onChange={(e) => setAAprovar(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-aprovados" className="text-xs font-semibold text-slate-700">
                  Aprovados (R$)
                </label>
                <input
                  id="nc-aprovados"
                  type="number"
                  step="any"
                  value={aprovados}
                  onChange={(e) => setAprovados(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                />
              </div>
            </div>
          </section>

          <section className="cartao space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="titulo-secao">3. Valores Contratuais e Execução (R$)</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Valores pactuados na planilha (exibidos nos recortes 31 e 89) com cálculo automático de execução.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-valor-total" className="text-xs font-semibold text-slate-700">
                  Valor Total (R$)
                </label>
                <input
                  id="nc-valor-total"
                  type="number"
                  step="any"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-repasse" className="text-xs font-semibold text-slate-700">
                  Repasse do Estado (R$)
                </label>
                <input
                  id="nc-repasse"
                  type="number"
                  step="any"
                  value={repasseEstado}
                  onChange={(e) => setRepasseEstado(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-contrapartida" className="text-xs font-semibold text-slate-700">
                  Contrapartida (R$)
                </label>
                <input
                  id="nc-contrapartida"
                  type="number"
                  step="any"
                  value={contrapartida}
                  onChange={(e) => setContrapartida(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-investido" className="text-xs font-semibold text-slate-700">
                  Investido pelo Estado (R$)
                </label>
                <input
                  id="nc-investido"
                  type="number"
                  step="any"
                  value={investidoEstado}
                  onChange={(e) => setInvestidoEstado(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-a-repassar" className="text-xs font-semibold text-slate-700">
                  A repassar (R$)
                </label>
                <input
                  id="nc-a-repassar"
                  type="number"
                  step="any"
                  placeholder={String(aRepassarCalculado)}
                  value={aRepassarManual}
                  onChange={(e) => setARepassarManual(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-2xs focus:border-marca-600 focus:outline-hidden focus:ring-2 focus:ring-marca-600/20"
                />
              </div>
              <div className="flex flex-col justify-center rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <div>
                  % Execução (Investido / Repasse):{' '}
                  <strong className="tabular-nums text-slate-900">{percentual(execucaoPct)}</strong>
                </div>
                <div className="mt-1">
                  % Investido / Valor Total:{' '}
                  <strong className="tabular-nums text-slate-900">{percentual(investidoSobreTotalPct)}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Bloco 3: Vínculos opcionais com Prestação de Contas e Tomada de Contas */}
        <section className="cartao space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="titulo-secao">4. Vínculo com Prestação de Contas e Tomada de Contas (Opcional)</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Marque abaixo se desejar que este convênio já crie automaticamente um registro nas abas Prestação de Contas ou Tomada de Contas.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={incluirPrestacao}
                  onChange={(e) => setIncluirPrestacao(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-marca-600 focus:ring-marca-600"
                />
                Incluir registro na aba Prestação de Contas
              </label>
              {incluirPrestacao && (
                <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="nc-parcela" className="text-xs font-semibold text-slate-700">
                      Parcela
                    </label>
                    <input
                      id="nc-parcela"
                      type="number"
                      min={1}
                      value={parcela}
                      onChange={(e) => setParcela(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="nc-baixa-apres" className="text-xs font-semibold text-slate-700">
                      Baixa Apresentação
                    </label>
                    <input
                      id="nc-baixa-apres"
                      type="text"
                      value={baixaApresentacao}
                      onChange={(e) => setBaixaApresentacao(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="nc-baixa-aprov" className="text-xs font-semibold text-slate-700">
                      Baixa Aprovação
                    </label>
                    <input
                      id="nc-baixa-aprov"
                      type="text"
                      value={baixaAprovacao}
                      onChange={(e) => setBaixaAprovacao(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={incluirTomada}
                  onChange={(e) => setIncluirTomada(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-marca-600 focus:ring-marca-600"
                />
                Incluir registro na aba Tomada de Contas
              </label>
              {incluirTomada && (
                <div className="pt-2">
                  <label htmlFor="nc-parecer" className="text-xs font-semibold text-slate-700">
                    Parecer da Comissão / Fase da TCE
                  </label>
                  <input
                    id="nc-parecer"
                    type="text"
                    value={parecerComissao}
                    onChange={(e) => setParecerComissao(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={criar.isPending}
              className="rounded-lg bg-marca-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-marca-700 disabled:opacity-50"
            >
              {criar.isPending ? 'Cadastrando convênio…' : 'Cadastrar Convênio'}
            </button>
          </div>
        </section>
      </form>
    </div>
  )
}

export function TelaNovoConvenio() {
  const navegar = useNavigate()
  const editar = useEditarConvenio()
  const [criados, setCriados] = useState<LinhaConvenio[]>([])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-tela">Novo Convênio</h1>
        <p className="subtitulo-tela">
          Cadastre um novo convênio com normalização automática de códigos SIAFE (SEOBRAS e SEIOP), saldos contábeis,
          valores contratuais e vínculo opcional com Prestação e Tomada de Contas.
        </p>
      </header>

      <FormularioNovoConvenio
        onCriado={(novo) =>
          setCriados((ant) => [
            novo,
            ...ant.filter((x) => !(x.numero_convenio === novo.numero_convenio && x.municipio === novo.municipio)),
          ])
        }
      />

      {criados.length > 0 && (
        <section className="space-y-3">
          <h2 className="titulo-secao">Convênios cadastrados nesta sessão</h2>
          <TabelaPaginada
            colunas={COLUNAS_CRIADOS}
            itens={criados}
            chave={(i) => `${i.numero_convenio}|${i.municipio}`}
            total={criados.length}
            pagina={1}
            tamanho={20}
            ordem={null}
            onOrdem={() => {}}
            onPagina={() => {}}
            onLinha={(i) => navegar(linkDetalhe(i.numero_convenio, i.municipio, new URLSearchParams()))}
            unidade={['convênio cadastrado', 'convênios cadastrados']}
            onSalvarEdicao={(item, alt) =>
              editar.mutateAsync({ ...alt, numero_convenio: item.numero_convenio, municipio: item.municipio })
            }
          />
        </section>
      )}
    </div>
  )
}
