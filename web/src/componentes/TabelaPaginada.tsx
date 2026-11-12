import { useState, type FormEvent, type ReactNode } from 'react'

export interface Coluna<T> {
  /** Campo da API; se `ordenavel`, é o valor enviado em `ordem` (só campos da whitelist do endpoint). */
  campo: string
  rotulo: string
  valor: (item: T) => ReactNode
  ordenavel?: boolean
  numerica?: boolean
  /** Fica fixa à esquerda na rolagem horizontal. */
  fixa?: boolean
  /** Se verdadeiro, não exibe este campo no formulário de edição (ex.: percentuais calculados). */
  somenteLeitura?: boolean
}

export interface CampoEdicao {
  campo: string
  rotulo: string
  numerico?: boolean
  somenteLeitura?: boolean
}

interface Props<T> {
  colunas: Coluna<T>[]
  itens: T[]
  chave: (item: T) => string
  total: number
  pagina: number
  tamanho: number
  ordem: string | null
  onOrdem: (ordem: string) => void
  onPagina: (pagina: number) => void
  onLinha?: (item: T) => void
  rotuloLinha?: (item: T) => string
  vazio?: string
  /** Nome do que a tabela lista, no total ("83 municípios"). */
  unidade: [singular: string, plural: string]
  atualizando?: boolean
  /** Callback opcional para persistir a edição da linha na API. */
  onSalvarEdicao?: (itemOriginal: T, alteracoes: Record<string, unknown>) => Promise<unknown> | void
  /** Callback opcional para remover o item da tabela e da API. */
  onRemoverItem?: (itemOriginal: T) => Promise<unknown> | void
  /** Callback opcional para exportar relatório em PDF do item. */
  onExportarPdf?: (itemOriginal: T) => Promise<unknown> | void
  /** Lista opcional de campos editáveis; se omitida, usa as colunas da própria tabela. */
  camposEdicao?: CampoEdicao[]
  /** Se falso, oculta a coluna Ações / Editar (ex.: na tela de Cargas). Padrão: true. */
  editavel?: boolean
  /** Função opcional para destacar uma linha recém-adicionada com sombreado verde claro. */
  destacarLinha?: (item: T) => boolean
}

const CAMPOS_CALCULADOS = new Set(['id', 'execucao_pct', 'investido_sobre_total_pct'])

/** Próxima ordem ao clicar no cabeçalho: crescente, depois decrescente. */
export function proximaOrdem(atual: string | null, campo: string): string {
  return atual === campo ? `-${campo}` : campo
}

export function TabelaPaginada<T>(p: Props<T>) {
  const paginas = Math.max(1, Math.ceil(p.total / p.tamanho))
  const [um, varios] = p.unidade
  const mostrarAcoes = p.editavel !== false

  const [itemEditando, setItemEditando] = useState<T | null>(null)
  const [valoresForm, setValoresForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [edicoesLocais, setEdicoesLocais] = useState<Record<string, Record<string, unknown>>>({})
  const [removidosLocais, setRemovidosLocais] = useState<Record<string, boolean>>({})
  const [removendoChave, setRemovendoChave] = useState<string | null>(null)
  const [itemParaRemover, setItemParaRemover] = useState<T | null>(null)
  const [etapaRemocao, setEtapaRemocao] = useState<1 | 2>(1)
  const [erroRemover, setErroRemover] = useState<string | null>(null)
  const [exportandoPdfChave, setExportandoPdfChave] = useState<string | null>(null)

  const handleExportarPdf = async (item: T) => {
    if (!p.onExportarPdf) return
    const ch = p.chave(item)
    setExportandoPdfChave(ch)
    try {
      await p.onExportarPdf(item)
    } finally {
      setExportandoPdfChave(null)
    }
  }

  const iniciarRemocao = (item: T) => {
    setErroRemover(null)
    setEtapaRemocao(1)
    setItemParaRemover(item)
  }

  const fecharModalRemocao = () => {
    if (removendoChave) return
    setItemParaRemover(null)
    setEtapaRemocao(1)
    setErroRemover(null)
  }

  const confirmarRemocaoFinal = async () => {
    if (!p.onRemoverItem || !itemParaRemover) return
    const ch = p.chave(itemParaRemover)
    setRemovendoChave(ch)
    setErroRemover(null)
    try {
      await p.onRemoverItem(itemParaRemover)
      setRemovidosLocais((ant) => ({ ...ant, [ch]: true }))
      setItemParaRemover(null)
      setEtapaRemocao(1)
    } catch (err) {
      setErroRemover(err instanceof Error ? err.message : 'Não foi possível remover o convênio.')
    } finally {
      setRemovendoChave(null)
    }
  }

  const itensVisiveis = p.itens.filter((i) => !removidosLocais[p.chave(i)])

  const camposFormulario: CampoEdicao[] =
    p.camposEdicao ??
    p.colunas.map((c) => ({
      campo: c.campo,
      rotulo: c.rotulo,
      numerico: c.numerica,
      somenteLeitura: c.somenteLeitura ?? CAMPOS_CALCULADOS.has(c.campo),
    }))

  const abrirEdicao = (item: T) => {
    const ch = p.chave(item)
    const mesclado = { ...(item as Record<string, unknown>), ...(edicoesLocais[ch] ?? {}) }
    const iniciais: Record<string, string> = {}
    for (const c of camposFormulario) {
      const val = mesclado[c.campo]
      iniciais[c.campo] = val === null || val === undefined ? '' : String(val)
    }
    setValoresForm(iniciais)
    setErroSalvar(null)
    setItemEditando(item)
  }

  const salvarEdicao = async (e: FormEvent) => {
    e.preventDefault()
    if (!itemEditando) return
    setSalvando(true)
    setErroSalvar(null)

    const alteracoes: Record<string, unknown> = {}
    for (const c of camposFormulario) {
      if (c.somenteLeitura) continue
      const texto = (valoresForm[c.campo] ?? '').trim()
      if (c.numerico) {
        if (texto === '') {
          alteracoes[c.campo] = null
        } else {
          const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto
          const n = Number(normalizado)
          alteracoes[c.campo] = Number.isNaN(n) ? null : n
        }
      } else {
        alteracoes[c.campo] = texto === '' ? null : texto
      }
    }

    const ch = p.chave(itemEditando)
    try {
      if (p.onSalvarEdicao) {
        await p.onSalvarEdicao(itemEditando, alteracoes)
      }
      setEdicoesLocais((ant) => ({ ...ant, [ch]: { ...(ant[ch] ?? {}), ...alteracoes } }))
      setItemEditando(null)
    } catch (err) {
      setErroSalvar(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-cartao transition-opacity ${
          p.atualizando ? 'opacity-60' : ''
        }`}
        aria-busy={p.atualizando || undefined}
      >
        {p.atualizando && (
          <div aria-hidden="true" className="absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-marca-100">
            <div className="h-full w-2/5 animate-indeterminado rounded-full bg-marca-500" />
          </div>
        )}
        {/* Rolagem própria nos dois eixos: é o que permite o cabeçalho fixo (sticky top-0) e a coluna fixa. */}
        <div className="max-h-[70vh] overflow-auto">
          <table className="tabela">
            <thead>
              <tr>
                {p.colunas.map((c) => {
                  const direcao =
                    p.ordem === c.campo ? 'ascending' : p.ordem === `-${c.campo}` ? 'descending' : undefined
                  return (
                    <th
                      key={c.campo}
                      scope="col"
                      aria-sort={direcao}
                      className={`tabela-th sticky top-0 ${c.numerica ? 'text-right' : ''} ${c.fixa ? 'left-0 z-20' : 'z-10'}`}
                    >
                      {c.ordenavel ? (
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 rounded uppercase tracking-wider hover:text-marca-800 focus-visible:outline-2 focus-visible:outline-marca-600 ${
                            c.numerica ? 'flex-row-reverse' : ''
                          } ${direcao ? 'text-marca-800' : ''}`}
                          onClick={() => p.onOrdem(proximaOrdem(p.ordem, c.campo))}
                        >
                          {c.rotulo}
                          <span aria-hidden="true" className="w-3">
                            {direcao === 'ascending' ? '▲' : direcao === 'descending' ? '▼' : ''}
                          </span>
                        </button>
                      ) : (
                        c.rotulo
                      )}
                    </th>
                  )
                })}
                {mostrarAcoes && (
                  <th scope="col" className="tabela-th sticky top-0 right-0 z-20 text-right">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {itensVisiveis.length === 0 ? (
                <tr>
                  <td colSpan={p.colunas.length + (mostrarAcoes ? 1 : 0)} className="px-4 py-10 text-center text-slate-500">
                    {p.vazio ?? 'Nenhum item encontrado.'}
                  </td>
                </tr>
              ) : (
                itensVisiveis.map((itemOriginal, k) => {
                  const ch = p.chave(itemOriginal)
                  const item = edicoesLocais[ch]
                    ? ({ ...itemOriginal, ...edicoesLocais[ch] } as T)
                    : itemOriginal
                  const destacada = p.destacarLinha?.(item) ?? false
                  return (
                    <tr
                      key={ch}
                      style={{ animationDelay: `${Math.min(k, 10) * 30}ms` }}
                      className={`group animate-surgir transition-colors ${
                        destacada
                          ? 'bg-emerald-50/90 shadow-[inset_3px_0_0_0_#10b981,0_2px_10px_-2px_rgba(16,185,129,0.22)] hover:bg-emerald-100/80'
                          : p.onLinha
                            ? 'hover:bg-marca-50 focus-visible:bg-marca-50'
                            : ''
                      } ${
                        p.onLinha
                          ? 'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca-600'
                          : ''
                      }`}
                      onClick={p.onLinha ? () => p.onLinha?.(item) : undefined}
                      onKeyDown={
                        p.onLinha
                          ? (e) => {
                              if (e.key === 'Enter') p.onLinha?.(item)
                            }
                          : undefined
                      }
                      tabIndex={p.onLinha ? 0 : undefined}
                      aria-label={p.rotuloLinha?.(item)}
                    >
                      {p.colunas.map((c, ic) => (
                        <td
                          key={c.campo}
                          className={`tabela-td whitespace-nowrap ${
                            c.numerica ? 'text-right tabular-nums' : ''
                          } ${
                            c.fixa
                              ? `sticky left-0 z-[1] font-medium text-slate-900 ${
                                  destacada
                                    ? 'bg-emerald-50 shadow-[inset_3px_0_0_0_#10b981] group-hover:bg-emerald-100'
                                    : `bg-white ${p.onLinha ? 'group-hover:bg-marca-50 group-focus-visible:bg-marca-50' : ''}`
                                }`
                              : ''
                          }`}
                        >
                          {c.valor(item)}
                          {/* Linha clicável: seta no fim indica que abre o detalhe. */}
                          {p.onLinha && ic === p.colunas.length - 1 && (
                            <span
                              aria-hidden="true"
                              className="ml-2 inline-block -translate-x-1 text-marca-600 opacity-0 transition-[opacity,translate] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                            >
                              ›
                            </span>
                          )}
                        </td>
                      ))}
                      {mostrarAcoes && (
                        <td
                          className={`tabela-td sticky right-0 z-[1] text-right whitespace-nowrap ${
                            destacada
                              ? 'bg-emerald-50 group-hover:bg-emerald-100'
                              : `bg-white ${p.onLinha ? 'group-hover:bg-marca-50 group-focus-visible:bg-marca-50' : ''}`
                          }`}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {p.onExportarPdf && (
                              <button
                                type="button"
                                disabled={exportandoPdfChave === ch}
                                onClick={() => void handleExportarPdf(item)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-marca-300 hover:bg-marca-50 hover:text-marca-800 focus-visible:outline-2 focus-visible:outline-marca-600 disabled:opacity-50"
                                title="Exportar relatório em PDF deste convênio"
                              >
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="size-3.5 text-marca-600"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <path d="M12 18v-6" />
                                  <path d="m9 15 3 3 3-3" />
                                </svg>
                                {exportandoPdfChave === ch ? 'Gerando…' : 'PDF'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => abrirEdicao(item)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-marca-300 hover:bg-marca-50 hover:text-marca-800 focus-visible:outline-2 focus-visible:outline-marca-600"
                              title="Editar este item"
                            >
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="size-3.5 text-marca-600"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                              Editar
                            </button>
                            {p.onRemoverItem && (
                              <button
                                type="button"
                                disabled={removendoChave === ch}
                                onClick={() => iniciarRemocao(item)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 shadow-2xs transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50"
                                title="Remover este convênio"
                              >
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="size-3.5 text-red-600"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M3 6h18" />
                                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                                {removendoChave === ch ? 'Removendo…' : 'Remover'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <nav
          aria-label="Paginação"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 bg-slate-50/60 px-4 py-3 text-sm text-slate-600"
        >
          <span className="font-medium tabular-nums text-slate-700">
            {p.total} {p.total === 1 ? um : varios}
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              className="botao-secundario"
              disabled={p.pagina <= 1}
              onClick={() => p.onPagina(p.pagina - 1)}
            >
              Anterior
            </button>
            <span className="tabular-nums">
              Página {p.pagina} de {paginas}
            </span>
            <button
              type="button"
              className="botao-secundario"
              disabled={p.pagina >= paginas}
              onClick={() => p.onPagina(p.pagina + 1)}
            >
              Próxima
            </button>
          </span>
        </nav>
      </div>

      {itemEditando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => !salvando && setItemEditando(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-edicao-titulo"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 id="modal-edicao-titulo" className="text-lg font-semibold text-slate-900">
                  Editar registro
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Altere os campos desejados abaixo e clique em Salvar alterações.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setItemEditando(null)}
                disabled={salvando}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fechar modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void salvarEdicao(e)} className="mt-4 space-y-4">
              {erroSalvar && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                  {erroSalvar}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {camposFormulario.map((c) => (
                  <div key={c.campo} className="flex flex-col gap-1">
                    <label htmlFor={`campo-edicao-${c.campo}`} className="text-xs font-semibold text-slate-700">
                      {c.rotulo}
                      {c.somenteLeitura && <span className="ml-1 font-normal text-slate-400">(automático)</span>}
                    </label>
                    <input
                      id={`campo-edicao-${c.campo}`}
                      type="text"
                      inputMode={c.numerico ? 'decimal' : 'text'}
                      disabled={c.somenteLeitura || salvando}
                      value={valoresForm[c.campo] ?? ''}
                      onChange={(e) => setValoresForm((ant) => ({ ...ant, [c.campo]: e.target.value }))}
                      className={`rounded-xl border px-3 py-2 text-sm transition-colors focus:border-marca-600 focus:outline-none ${
                        c.somenteLeitura
                          ? 'border-slate-200 bg-slate-100 text-slate-500'
                          : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400'
                      }`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setItemEditando(null)}
                  disabled={salvando}
                  className="botao-secundario"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="botao-primario">
                  {salvando ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemParaRemover && (() => {
        const reg = itemParaRemover as Record<string, unknown>
        const num = typeof reg.numero_convenio === 'string' ? reg.numero_convenio : null
        const mun = typeof reg.municipio === 'string' ? reg.municipio : null
        const identificacao = num && mun ? `Convênio nº ${num} (${mun})` : p.chave(itemParaRemover)
        const emAndamento = Boolean(removendoChave)

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
            onClick={fecharModalRemocao}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-remocao-titulo"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      etapaRemocao === 1
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    Etapa {etapaRemocao} de 2
                  </span>
                  <h2 id="modal-remocao-titulo" className="mt-1.5 text-lg font-semibold text-slate-900">
                    {etapaRemocao === 1 ? 'Remover convênio?' : 'Confirmação final de exclusão'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={fecharModalRemocao}
                  disabled={emAndamento}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Fechar confirmação"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-medium text-slate-900">
                  {identificacao}
                </div>

                {etapaRemocao === 1 ? (
                  <p className="text-xs leading-relaxed text-slate-600">
                    Você solicitou a remoção deste registro. Deseja avançar para a segunda etapa de confirmação?
                  </p>
                ) : (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-relaxed text-red-900">
                    <strong className="font-semibold">Atenção:</strong> esta é a confirmação final. Ao prosseguir, o
                    convênio será removido da listagem e dos indicadores do município.
                  </div>
                )}

                {erroRemover && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                    {erroRemover}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                {etapaRemocao === 2 && (
                  <button
                    type="button"
                    onClick={() => setEtapaRemocao(1)}
                    disabled={emAndamento}
                    className="botao-secundario"
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="button"
                  onClick={fecharModalRemocao}
                  disabled={emAndamento}
                  className="botao-secundario"
                >
                  Cancelar
                </button>
                {etapaRemocao === 1 ? (
                  <button
                    type="button"
                    onClick={() => setEtapaRemocao(2)}
                    className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600"
                  >
                    Continuar (1/2)
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={emAndamento}
                    onClick={() => void confirmarRemocaoFinal()}
                    className="inline-flex items-center justify-center rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50"
                  >
                    {emAndamento ? 'Removendo…' : 'Confirmar exclusão definitiva'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
