import { Link, useSearchParams } from 'react-router'

import { ApiErro } from '../api/cliente'
import { useConvenio } from '../api/hooks'
import { CaixaErro, Carregando } from '../componentes/Estados'
import { GraficoSerie } from '../componentes/GraficoSerie'
import { lerFiltros, useMesReferencia } from '../filtros'
import { AUSENTE, data, mesAno, moeda } from '../formato'
import { BlocoContratual, CAMPOS_SALDO, CartoesSaldo, linkDetalhe } from './comum'

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="font-medium">{children}</dd>
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
          <h1 className="text-lg font-semibold">Convênio não encontrado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Não há convênio {numero} em {municipio} na planilha carregada.
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
    <div className="space-y-4">
      <div>
        <Link to="/convenios" className="botao-link">
          ← Convênios
        </Link>
        <h1 className="mt-1 text-lg font-semibold">
          Convênio {d.numero_convenio} · {d.municipio}
        </h1>
      </div>

      <section className="cartao" aria-label="Identificação">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
          <Campo rotulo="Fase">{d.fase}</Campo>
          <Campo rotulo="Status">{d.status ?? AUSENTE}</Campo>
          <Campo rotulo="Situação da vigência">{d.situacao_vigencia ?? AUSENTE}</Campo>
          <Campo rotulo="Fim da vigência">{data(d.vigencia_final)}</Campo>
          <Campo rotulo="Código SEOBRAS">{d.codigo_seobras ?? AUSENTE}</Campo>
          <Campo rotulo="Código SEIOP">{d.codigo_seiop ?? AUSENTE}</Campo>
          <Campo rotulo="Recortes">{d.recortes.join(', ')}</Campo>
        </dl>
        <div className="mt-3 text-sm">
          <p className="text-xs text-slate-500">Objeto</p>
          <p>{d.objeto ?? AUSENTE}</p>
        </div>
        {d.codigo_compartilhado && (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
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

      <section aria-label="Saldos do mês" className="space-y-2">
        <h2 className="titulo-secao">Saldos SIAFE · {mesAno(d.referencia.ano, d.referencia.mes)}</h2>
        {!d.saldos && (
          <p className="text-sm text-slate-500">O SIAFE não tem dados de {mesAno(d.referencia.ano, d.referencia.mes)}.</p>
        )}
        <CartoesSaldo saldos={d.saldos} anterior={d.mes_anterior} />
        <p className="text-xs text-slate-500">
          Mês anterior ({mesAno(anterior.ano, anterior.mes)}):{' '}
          {d.mes_anterior
            ? CAMPOS_SALDO.map(({ campo, rotulo }) => `${rotulo} ${moeda(d.mes_anterior?.[campo])}`).join(' · ')
            : 'sem dados'}
        </p>
      </section>

      {d.contratual.length === 0 ? (
        <p className="cartao text-sm text-slate-600">
          Não há valores contratuais para este convênio (ele não está nas abas 31 nem 89 da planilha).
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {d.contratual.map((c) => (
            <BlocoContratual key={c.recorte} titulo={`Valores contratuais · aba ${c.recorte}`} valores={c} />
          ))}
        </div>
      )}

      <GraficoSerie titulo="Saldos SIAFE do convênio por mês" pontos={d.serie} />
    </div>
  )
}
