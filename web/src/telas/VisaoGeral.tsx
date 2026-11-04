import { useResumo, useSerie } from '../api/hooks'
import type { Resumo } from '../api/tipos'
import { Aviso, CaixaErro, Carregando } from '../componentes/Estados'
import { GraficoSerie } from '../componentes/GraficoSerie'
import { useFiltros, useMesReferencia } from '../filtros'
import { AUSENTE, dataHora, inteiro, mesAno, moeda, percentual } from '../formato'
import { NOME_RECORTE } from '../recortes'
import { BlocoContratual, CAMPOS_SALDO, CartaoDestaque, CartoesSaldo } from './comum'

function Situacao({ situacao }: { situacao: NonNullable<Resumo['situacao']> }) {
  const lista = (titulo: string, itens: { valor: string | null; convenios: number }[]) => (
    <div>
      <h3 className="rotulo-campo">{titulo}</h3>
      <ul className="mt-2 divide-y divide-slate-100 text-sm">
        {itens.map((i) => (
          <li key={i.valor ?? ''} className="flex justify-between gap-4 py-1.5">
            <span>{i.valor ?? 'Sem informação'}</span>
            <span className="tabular-nums font-medium">{inteiro(i.convenios)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
  return (
    <section className="cartao" aria-label="Situação dos convênios">
      <h2 className="titulo-secao">Situação dos convênios</h2>
      <div className="mt-3 grid gap-6 md:grid-cols-2">
        {lista('Por status', situacao.status)}
        {lista('Por situação da vigência', situacao.situacao_vigencia)}
      </div>
    </section>
  )
}

function Cobertura({ cobertura }: { cobertura: NonNullable<NonNullable<Resumo['siafe']>['cobertura']> }) {
  return (
    <section className="cartao" aria-label="Cobertura do SIAFE">
      <h2 className="titulo-secao">Cobertura: vinculado aos convênios × total do SIAFE</h2>
      <table className="mt-3 min-w-full text-sm">
        <thead className="text-left text-xs text-slate-600">
          <tr>
            <th scope="col" className="border-b border-slate-200 px-2 py-2 font-medium">
              Saldo
            </th>
            <th scope="col" className="border-b border-slate-200 px-2 py-2 text-right font-medium">
              Vinculado
            </th>
            <th scope="col" className="border-b border-slate-200 px-2 py-2 text-right font-medium">
              Total SIAFE
            </th>
            <th scope="col" className="border-b border-slate-200 px-2 py-2 text-right font-medium">
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
              <tr key={campo} className="even:bg-slate-50/60">
                <td className="border-b border-slate-100 px-2 py-2">{rotulo}</td>
                <td className="border-b border-slate-100 px-2 py-2 text-right tabular-nums">{moeda(v)}</td>
                <td className="border-b border-slate-100 px-2 py-2 text-right tabular-nums">{moeda(t)}</td>
                <td className="border-b border-slate-100 px-2 py-2 text-right tabular-nums">{percentual(pct)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
    <div className="space-y-4">
      <h1 className="titulo-tela">Visão geral</h1>
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
              <CartaoDestaque rotulo="Convênios" valor={inteiro(r.convenios)}>
                <p className="text-xs text-slate-500">
                  {NOME_RECORTE[r.recorte]}
                  {r.municipios.length > 0 && ` · ${r.municipios.join(', ')}`} · {mesAno(r.referencia.ano, r.referencia.mes)}
                </p>
              </CartaoDestaque>
            }
          />
          {r.contratual && <BlocoContratual titulo="Valores contratuais" valores={r.contratual} />}
          {r.situacao && <Situacao situacao={r.situacao} />}
          {r.siafe?.cobertura && <Cobertura cobertura={r.siafe.cobertura} />}
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
        <p className="text-xs text-slate-600">
          Posição do SIAFE em {dataHora(r.referencia.posicao_siafe_em)} · planilha importada em{' '}
          {dataHora(r.referencia.planilha_importada_em)}
          {r.referencia.arquivo ? ` (${r.referencia.arquivo})` : ''}
          {!r.referencia.posicao_siafe_em && !r.referencia.planilha_importada_em ? ` ${AUSENTE}` : ''}
        </p>
      )}
    </div>
  )
}
