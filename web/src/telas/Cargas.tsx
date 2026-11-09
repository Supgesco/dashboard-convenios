import { useState } from 'react'

import { TAMANHO_PAGINA, useDispararCarga, useExecucoes, useResumoGeral, useStatusCarga } from '../api/hooks'
import type { ExecucaoStatus } from '../api/tipos'
import { CaixaErro, Carregando } from '../componentes/Estados'
import { TabelaPaginada, type Coluna } from '../componentes/TabelaPaginada'
import { useFiltros } from '../filtros'
import { AUSENTE, dataHora, inteiro } from '../formato'

const ROTULO_STATUS: Record<string, string> = {
  em_andamento: 'Em andamento',
  sucesso: 'Sucesso',
  falha: 'Falha',
}

function Status({ status }: { status: string }) {
  const estilo =
    status === 'sucesso'
      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
      : status === 'falha'
        ? 'bg-red-50 text-red-800 ring-1 ring-red-200'
        : 'bg-marca-50 text-marca-800 ring-1 ring-marca-200'
  const icone = status === 'sucesso' ? '✓' : status === 'falha' ? '✕' : '⟳'
  return (
    <span className={`selo ${estilo}`}>
      <span aria-hidden="true">{icone}</span>
      {ROTULO_STATUS[status] ?? status}
    </span>
  )
}

const COLUNAS: Coluna<ExecucaoStatus>[] = [
  { campo: 'id', rotulo: 'Nº', numerica: true, valor: (e) => e.id },
  { campo: 'status', rotulo: 'Status', valor: (e) => <Status status={e.status} /> },
  { campo: 'origem', rotulo: 'Origem', valor: (e) => e.origem },
  { campo: 'inicio', rotulo: 'Início', valor: (e) => dataHora(e.inicio) },
  { campo: 'fim', rotulo: 'Fim', valor: (e) => dataHora(e.fim) },
  { campo: 'registros', rotulo: 'Registros', numerica: true, valor: (e) => inteiro(e.registros) },
  {
    campo: 'erro',
    rotulo: 'Erro',
    valor: (e) => (e.erro ? <span className="block max-w-md truncate" title={e.erro}>{e.erro}</span> : AUSENTE),
  },
]

function UltimaCarga() {
  const status = useStatusCarga()
  if (status.isError) return <CaixaErro erro={status.error} onTentar={() => void status.refetch()} />
  if (status.isPending) return <Carregando />
  const e = status.data
  if (!e) return <p className="text-sm text-slate-600">Nenhuma carga SIAFE foi feita até agora.</p>
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      <p className="flex items-center gap-2">
        <Status status={e.status} />
        {e.status === 'em_andamento' && <span className="text-slate-500">atualizando a cada 5 segundos…</span>}
      </p>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-gelo px-4 py-3">
          <dt className="text-xs font-medium text-slate-600">Origem</dt>
          <dd>{e.origem}</dd>
        </div>
        <div className="rounded-xl bg-gelo px-4 py-3">
          <dt className="text-xs font-medium text-slate-600">Início</dt>
          <dd>{dataHora(e.inicio)}</dd>
        </div>
        <div className="rounded-xl bg-gelo px-4 py-3">
          <dt className="text-xs font-medium text-slate-600">Fim</dt>
          <dd>{dataHora(e.fim)}</dd>
        </div>
        <div className="rounded-xl bg-gelo px-4 py-3">
          <dt className="text-xs font-medium text-slate-600">Registros</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{inteiro(e.registros)}</dd>
        </div>
      </dl>
      {e.erro && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
          <span className="font-medium">Erro: </span>
          {e.erro}
        </p>
      )}
    </div>
  )
}

function Disparo() {
  const status = useStatusCarga()
  const disparo = useDispararCarga()
  const [confirmando, setConfirmando] = useState(false)
  const emAndamento = status.data?.status === 'em_andamento'

  const confirmar = () => {
    setConfirmando(false)
    disparo.mutate()
  }

  return (
    <div>
      <button
        type="button"
        className="botao-primario"
        disabled={emAndamento || disparo.isPending || confirmando}
        onClick={() => setConfirmando(true)}
      >
        Iniciar carga SIAFE
      </button>
      {disparo.data?.tipo === 'ja_em_andamento' && (
        <p role="status" className="mt-2 text-sm text-marca-900">
          Já existe uma carga SIAFE em andamento. A tela está acompanhando essa carga.
        </p>
      )}
      {disparo.isError && <CaixaErro erro={disparo.error} titulo="Não foi possível iniciar a carga" />}

      {confirmando && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-titulo"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="confirmar-titulo" className="text-base font-semibold">
              Iniciar a carga SIAFE?
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
              <li>A carga faz login no SIAFE. Logins repetidos já bloquearam o IP desta máquina.</li>
              <li>Ela substitui todos os dados atuais do SIAFE quando termina com sucesso.</li>
              <li>Leva alguns minutos; a tela acompanha o andamento.</li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="botao-secundario" onClick={() => setConfirmando(false)} autoFocus>
                Cancelar
              </button>
              <button type="button" className="botao-primario" onClick={confirmar}>
                Iniciar carga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Historico() {
  const { filtros, mudar } = useFiltros()
  const consulta = useExecucoes(filtros.pagina)
  if (consulta.isError) return <CaixaErro erro={consulta.error} onTentar={() => void consulta.refetch()} />
  if (!consulta.data) return <Carregando />
  return (
    <TabelaPaginada
      colunas={COLUNAS}
      itens={consulta.data.itens}
      chave={(e) => String(e.id)}
      total={consulta.data.total}
      pagina={filtros.pagina}
      tamanho={TAMANHO_PAGINA}
      ordem={null}
      onOrdem={() => {}}
      onPagina={(pagina) => mudar({ pagina })}
      unidade={['carga', 'cargas']}
      vazio="Nenhuma carga SIAFE registrada."
      atualizando={consulta.isPlaceholderData}
      editavel={false}
    />
  )
}

function Planilha() {
  const resumo = useResumoGeral()
  if (resumo.isError) return <CaixaErro erro={resumo.error} onTentar={() => void resumo.refetch()} />
  if (!resumo.data) return <Carregando />
  const { arquivo, planilha_importada_em } = resumo.data.referencia
  return planilha_importada_em ? (
    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-xl bg-gelo px-4 py-3">
        <dt className="text-xs font-medium text-slate-600">Arquivo</dt>
        <dd>{arquivo ?? AUSENTE}</dd>
      </div>
      <div className="rounded-xl bg-gelo px-4 py-3">
        <dt className="text-xs font-medium text-slate-600">Importada em</dt>
        <dd>{dataHora(planilha_importada_em)}</dd>
      </div>
    </dl>
  ) : (
    <p className="text-sm text-slate-600">Nenhuma importação da planilha registrada.</p>
  )
}

export function TelaCargas() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-tela">Cargas</h1>
        <p className="subtitulo-tela">Última carga do SIAFE, histórico e importação da planilha.</p>
      </header>
      <section className="cartao space-y-4" aria-label="Carga SIAFE">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="titulo-secao">Última carga SIAFE</h2>
          <Disparo />
        </div>
        <UltimaCarga />
      </section>
      <section className="space-y-3" aria-label="Histórico de cargas">
        <h2 className="titulo-secao">Histórico de cargas SIAFE</h2>
        <Historico />
      </section>
      <section className="cartao space-y-4" aria-label="Planilha">
        <h2 className="titulo-secao">Planilha de convênios</h2>
        <Planilha />
        <p className="text-xs text-slate-500">A importação da planilha é feita pela linha de comando da API.</p>
      </section>
    </div>
  )
}
