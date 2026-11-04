import { useNavigate } from 'react-router'

import { TAMANHO_PAGINA, useConvenios } from '../api/hooks'
import type { LinhaConvenio } from '../api/tipos'
import { CaixaErro, Carregando } from '../componentes/Estados'
import { TabelaPaginada, type Coluna } from '../componentes/TabelaPaginada'
import { useFiltros, useMesReferencia } from '../filtros'
import { AUSENTE, mesAno, moeda, percentual } from '../formato'
import { CAMPOS_CONTRATUAL, CAMPOS_SALDO, LegendaCompartilhado, MarcaCompartilhado, linkDetalhe } from './comum'

// Campos ordenáveis = whitelist da API (consultas.ORDEM_LISTA); os códigos não são ordenáveis.
const BASE: Coluna<LinhaConvenio>[] = [
  {
    campo: 'numero_convenio',
    rotulo: 'Número',
    ordenavel: true,
    fixa: true,
    valor: (i) => (
      <>
        {i.numero_convenio}
        {i.codigo_compartilhado && <MarcaCompartilhado />}
      </>
    ),
  },
  { campo: 'municipio', rotulo: 'Município', ordenavel: true, valor: (i) => i.municipio },
  { campo: 'status', rotulo: 'Status', ordenavel: true, valor: (i) => i.status ?? AUSENTE },
  { campo: 'fase', rotulo: 'Fase', ordenavel: true, valor: (i) => i.fase },
  { campo: 'codigo_seobras', rotulo: 'SEOBRAS', valor: (i) => i.codigo_seobras ?? AUSENTE },
  { campo: 'codigo_seiop', rotulo: 'SEIOP', valor: (i) => i.codigo_seiop ?? AUSENTE },
  ...CAMPOS_SALDO.map(({ campo, rotulo }) => ({
    campo,
    rotulo,
    ordenavel: true,
    numerica: true,
    valor: (i: LinhaConvenio) => moeda(i[campo]),
  })),
]

const CONTRATUAIS: Coluna<LinhaConvenio>[] = CAMPOS_CONTRATUAL.map(({ campo, rotulo, pct }) => ({
  campo,
  rotulo,
  ordenavel: true,
  numerica: true,
  valor: (i: LinhaConvenio) => (pct ? percentual(i[campo]) : moeda(i[campo])),
}))

export function TelaConvenios() {
  const { filtros, busca, mudar, limpar } = useFiltros()
  const ref = useMesReferencia(filtros.mes)
  const consulta = useConvenios(filtros, ref.mes, filtros, { enabled: ref.resolvido })
  const navegar = useNavigate()
  const colunas = filtros.recorte === '342' ? BASE : [...BASE, ...CONTRATUAIS]
  const d = consulta.data

  return (
    <div className="space-y-4">
      <h1 className="titulo-tela">
        Convênios {d && <span className="text-sm font-normal text-slate-600">· {mesAno(d.ano, d.mes)}</span>}
      </h1>
      {consulta.isError ? (
        <CaixaErro erro={consulta.error} onTentar={() => void consulta.refetch()} onLimpar={limpar} />
      ) : !d ? (
        <Carregando />
      ) : (
        <>
          <TabelaPaginada
            colunas={colunas}
            itens={d.itens}
            chave={(i) => `${i.numero_convenio}|${i.municipio}`}
            total={d.total}
            pagina={filtros.pagina}
            tamanho={TAMANHO_PAGINA}
            ordem={filtros.ordem}
            onOrdem={(ordem) => mudar({ ordem })}
            onPagina={(pagina) => mudar({ pagina })}
            onLinha={(i) => navegar(linkDetalhe(i.numero_convenio, i.municipio, busca))}
            rotuloLinha={(i) => `Ver detalhe do convênio ${i.numero_convenio} de ${i.municipio}`}
            unidade={['convênio', 'convênios']}
            vazio="Nenhum convênio neste filtro."
            atualizando={consulta.isPlaceholderData}
          />
          <LegendaCompartilhado />
        </>
      )}
    </div>
  )
}
