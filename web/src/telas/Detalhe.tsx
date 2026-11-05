import { Link, useSearchParams } from 'react-router'

import { ApiErro } from '../api/cliente'
import { useConvenio } from '../api/hooks'
import { CaixaErro, Carregando } from '../componentes/Estados'
import { GraficoSerie } from '../componentes/GraficoSerie'
import { lerFiltros, useMesReferencia } from '../filtros'
import { AUSENTE, data, mesAno, moeda } from '../formato'
import { NOME_RECORTE, nomesRecortes } from '../recortes'
import { BlocoContratual, CAMPOS_SALDO, CartoesSaldo, linkDetalhe } from './comum'

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{children}</dd>
    </div>
  )
}

export function TelaDetalhe() {
  const [busca] = useSearchParams()
  const numero = busca.get('numero') ?? ''
  const municipio = busca.get('municipio') ?? ''
  const ref = useMesReferencia(lerFiltros(busca).mes)
  const consulta = useConvenio(numero, municipio, ref.mes, { enabled: ref.resolvido })
  const d = consulta.data

  if (consulta.isError) {
    const erro = consulta.error
    if (erro instanceof ApiErro && erro.status === 404) {
      return (
        <section className="cartao">
          <h1 className="titulo-tela">Convênio não encontrado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Não há convênio {numero} em {municipio}.
          </p>
          <Link to="/convenios" className="botao-link mt-3 inline-block">
            Ir para a lista de convênios
          </Link>
        </section>
      )
    }
    return (
      <div>
        <CaixaErro erro={erro} onTentar={() => void consulta.refetch()} titulo="Não foi possível abrir o convênio" />
        <Link to="/convenios" className="botao-link">
          Ir para a lista de convênios
        </Link>
      </div>
    )
  }
  if (!d) return <Carregando />

  const anterior = d.referencia.mes === 1 ? { ano: d.referencia.ano - 1, mes: 12 } : { ano: d.referencia.ano, mes: d.referencia.mes - 1 }

  return (
    <div className="space-y-6">
      <header>
        <Link to="/convenios" className="botao-link">
          ← Convênios
        </Link>
        <h1 className="titulo-tela mt-2">
          Convênio {d.numero_convenio} · {d.municipio}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {d.status && <span className="selo bg-marca-100 text-marca-800">{d.status}</span>}
          {d.situacao_vigencia && (
            <span className="selo border border-slate-200 bg-white text-slate-700">{d.situacao_vigencia}</span>
          )}
        </div>
      </header>

      <section className="cartao" aria-label="Identificação">
        <h2 className="titulo-secao">Identificação</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-4">
          <Campo rotulo="Fase">{d.fase}</Campo>
          <Campo rotulo="Status">{d.status ?? AUSENTE}</Campo>
          <Campo rotulo="Situação da vigência">{d.situacao_vigencia ?? AUSENTE}</Campo>
          <Campo rotulo="Fim da vigência">{data(d.vigencia_final)}</Campo>
          <Campo rotulo="Código SEOBRAS">{d.codigo_seobras ?? AUSENTE}</Campo>
          <Campo rotulo="Código SEIOP">{d.codigo_seiop ?? AUSENTE}</Campo>
          <Campo rotulo="Recortes">{nomesRecortes(d.recortes)}</Campo>
        </dl>
        <div className="mt-5 rounded-xl bg-gelo px-4 py-3.5 text-sm">
          <p className="text-xs font-medium text-slate-600">Objeto</p>
          <p className="mt-1 leading-relaxed text-slate-800">{d.objeto ?? AUSENTE}</p>
        </div>
        {d.codigo_compartilhado && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Código compartilhado com outros convênios</p>
            <ul className="mt-1 list-inside list-disc">
              {d.compartilhado_com.map((c) => (
                <li key={`${c.numero_convenio}|${c.municipio}|${c.codigo}`}>
                  <Link to={linkDetalhe(c.numero_convenio, c.municipio, busca)} className="botao-link">
                    {c.numero_convenio} · {c.municipio}
                  </Link>{' '}
                  (código {c.codigo})
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-label="Saldos do mês" className="space-y-3">
        <h2 className="titulo-secao">Saldos SIAFE · {mesAno(d.referencia.ano, d.referencia.mes)}</h2>
        {!d.saldos && (
          <p className="text-sm text-slate-600">O SIAFE não tem dados de {mesAno(d.referencia.ano, d.referencia.mes)}.</p>
        )}
        <CartoesSaldo saldos={d.saldos} anterior={d.mes_anterior} />
        <p className="text-xs text-slate-600">
          Mês anterior ({mesAno(anterior.ano, anterior.mes)}):{' '}
          {d.mes_anterior
            ? CAMPOS_SALDO.map(({ campo, rotulo }) => `${rotulo} ${moeda(d.mes_anterior?.[campo])}`).join(' · ')
            : 'sem dados'}
        </p>
      </section>

      {d.contratual.length === 0 ? (
        <p className="cartao text-sm text-slate-600">
          Não há valores contratuais para este convênio: ele não está nos recortes Vigentes nem Primeiro realinhamento.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {d.contratual.map((c) => (
            <BlocoContratual key={c.recorte} titulo={`Valores contratuais · ${NOME_RECORTE[c.recorte]}`} valores={c} />
          ))}
        </div>
      )}

      <GraficoSerie titulo="Saldos SIAFE do convênio por mês" pontos={d.serie} />
    </div>
  )
}
