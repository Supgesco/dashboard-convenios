import { useResumo, useSerie } from '../api/hooks'
import type { Resumo } from '../api/tipos'
import { Aviso, CaixaErro, Carregando } from '../componentes/Estados'
import { GraficoSerie } from '../componentes/GraficoSerie'
import { useFiltros, useMesReferencia } from '../filtros'
import { AUSENTE, dataHora, inteiro, mesAno, moeda, percentual } from '../formato'
import { NOME_RECORTE } from '../recortes'
import { COR_SERIE } from '../series'
import { BarraProgresso, BlocoContratual, CAMPOS_SALDO, CartaoDestaque, CartoesSaldo } from './comum'

function Situacao({ situacao }: { situacao: NonNullable<Resumo['situacao']> }) {
  const lista = (titulo: string, itens: { valor: string | null; convenios: number }[]) => {
    const maior = Math.max(0, ...itens.map((i) => i.convenios))
    return (
      <div>
        <h3 className="rotulo-campo">{titulo}</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {itens.map((i) => (
            <li key={i.valor ?? ''}>
              <div className="flex justify-between gap-4">
                <span className="text-slate-700">{i.valor ?? 'Sem informação'}</span>
                <span className="font-semibold tabular-nums text-slate-900">{inteiro(i.convenios)}</span>
              </div>
              <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-marca-500"
                  style={{ width: `${maior ? (i.convenios / maior) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <section className="cartao" aria-label="Situação dos convênios">
      <h2 className="titulo-secao">Situação dos convênios</h2>
      <div className="mt-5 grid gap-8 md:grid-cols-2">
        {lista('Por status', situacao.status)}
        {lista('Por situação da vigência', situacao.situacao_vigencia)}
      </div>
    </section>
  )
}

function Cobertura({ cobertura }: { cobertura: NonNullable<NonNullable<Resumo['siafe']>['cobertura']> }) {
  return (
    <section className="cartao" aria-label="Cobertura do SIAFE">
      <h2 className="titulo-secao">Cobertura do SIAFE</h2>
      <p className="subtitulo-secao">Saldo vinculado aos convênios × total do SIAFE</p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/70">
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col" className="tabela-th">
                Saldo
              </th>
              <th scope="col" className="tabela-th text-right">
                Vinculado
              </th>
              <th scope="col" className="tabela-th text-right">
                Total SIAFE
              </th>
              <th scope="col" className="tabela-th text-right">
                Cobertura
              </th>
            </tr>
          </thead>
        <tbody>
          {CAMPOS_SALDO.map(({ campo, rotulo }) => {
            const v = cobertura.vinculado[campo]
            const t = cobertura.total_siafe[campo]
            const pct = v !== null && t ? (v / t) * 100 : null
            return (
              <tr key={campo}>
                <td className="tabela-td">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: COR_SERIE[campo] }} />
                    {rotulo}
                  </span>
                </td>
                <td className="tabela-td text-right tabular-nums">{moeda(v)}</td>
                <td className="tabela-td text-right tabular-nums">{moeda(t)}</td>
                <td className="tabela-td text-right tabular-nums">
                  <span className="inline-flex items-center justify-end gap-2">
                    <span className="hidden w-16 sm:block">
                      <BarraProgresso pct={pct} rotulo={`Cobertura de ${rotulo}`} />
                    </span>
                    <span className="min-w-14 font-medium text-slate-900">{percentual(pct)}</span>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </section>
  )
}

export function TelaVisaoGeral() {
  const { filtros, limpar } = useFiltros()
  const ref = useMesReferencia(filtros.mes)
  const resumo = useResumo(filtros, ref.mes, { enabled: ref.resolvido })
  const serie = useSerie(filtros)
  const r = resumo.data

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-tela">Visão geral</h1>
        <p className="subtitulo-tela">
          {r
            ? `${NOME_RECORTE[r.recorte]} · referência ${mesAno(r.referencia.ano, r.referencia.mes)}`
            : 'Saldos SIAFE e valores contratuais dos convênios'}
        </p>
      </header>
      {resumo.isError ? (
        <CaixaErro erro={resumo.error} onTentar={() => void resumo.refetch()} onLimpar={limpar} />
      ) : !r ? (
        <Carregando />
      ) : (
        <>
          {!r.siafe && (
            <Aviso>
              O SIAFE não tem dados de {mesAno(r.referencia.ano, r.referencia.mes)}.{' '}
              {r.referencia.ultimo_mes_disponivel
                ? `Último mês disponível: ${mesAno(r.referencia.ultimo_mes_disponivel.ano, r.referencia.ultimo_mes_disponivel.mes)}.`
                : 'Nenhum mês foi carregado.'}
            </Aviso>
          )}
          <CartoesSaldo
            saldos={r.siafe}
            anterior={r.siafe?.mes_anterior}
            antes={
              <CartaoDestaque rotulo="Convênios" valor={inteiro(r.convenios)} escuro>
                <p>
                  {NOME_RECORTE[r.recorte]}
                  {r.municipios.length > 0 && ` · ${r.municipios.join(', ')}`} · {mesAno(r.referencia.ano, r.referencia.mes)}
                </p>
              </CartaoDestaque>
            }
          />
          {r.contratual && <BlocoContratual titulo="Valores contratuais" valores={r.contratual} />}
          {(r.situacao || r.siafe?.cobertura) && (
            <div className={`grid gap-6 ${r.situacao && r.siafe?.cobertura ? 'xl:grid-cols-2' : ''}`}>
              {r.situacao && <Situacao situacao={r.situacao} />}
              {r.siafe?.cobertura && <Cobertura cobertura={r.siafe.cobertura} />}
            </div>
          )}
        </>
      )}

      {serie.isError ? (
        <CaixaErro erro={serie.error} onTentar={() => void serie.refetch()} onLimpar={limpar} titulo="Não foi possível carregar a série" />
      ) : serie.data ? (
        <GraficoSerie titulo="Saldos SIAFE por mês" pontos={serie.data.pontos} />
      ) : (
        <Carregando texto="Carregando a série…" />
      )}

      {r && (
        <p className="border-t border-slate-200/70 pt-4 text-xs text-slate-600">
          Posição do SIAFE em {dataHora(r.referencia.posicao_siafe_em)} · planilha importada em{' '}
          {dataHora(r.referencia.planilha_importada_em)}
          {r.referencia.arquivo ? ` (${r.referencia.arquivo})` : ''}
          {!r.referencia.posicao_siafe_em && !r.referencia.planilha_importada_em ? ` ${AUSENTE}` : ''}
        </p>
      )}
    </div>
  )
}
