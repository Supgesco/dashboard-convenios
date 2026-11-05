import { useNavigate } from 'react-router'

import { TAMANHO_PAGINA, useMunicipios } from '../api/hooks'
import type { LinhaMunicipio } from '../api/tipos'
import { CaixaErro, Carregando } from '../componentes/Estados'
import { TabelaPaginada, type Coluna } from '../componentes/TabelaPaginada'
import { buscaGlobal, useFiltros, useMesReferencia } from '../filtros'
import { inteiro, mesAno, moeda, percentual } from '../formato'
import { CAMPOS_CONTRATUAL, CAMPOS_SALDO, LegendaCompartilhado, MarcaCompartilhado } from './comum'

// Todos os campos ordenáveis estão na whitelist da API (consultas.ORDEM_RANKING).
const BASE: Coluna<LinhaMunicipio>[] = [
  {
    campo: 'municipio',
    rotulo: 'Município',
    ordenavel: true,
    fixa: true,
    valor: (i) => (
      <>
        {i.municipio}
        {i.codigo_compartilhado && <MarcaCompartilhado />}
      </>
    ),
  },
  { campo: 'convenios', rotulo: 'Convênios', ordenavel: true, numerica: true, valor: (i) => inteiro(i.convenios) },
  ...CAMPOS_SALDO.map(({ campo, rotulo }) => ({
    campo,
    rotulo,
    ordenavel: true,
    numerica: true,
    valor: (i: LinhaMunicipio) => moeda(i[campo]),
  })),
]

const CONTRATUAIS: Coluna<LinhaMunicipio>[] = CAMPOS_CONTRATUAL.map(({ campo, rotulo, pct }) => ({
  campo,
  rotulo,
  ordenavel: true,
  numerica: true,
  valor: (i: LinhaMunicipio) => (pct ? percentual(i[campo]) : moeda(i[campo])),
}))

export function TelaMunicipios() {
  const { filtros, busca, mudar, limpar } = useFiltros()
  const ref = useMesReferencia(filtros.mes)
  const consulta = useMunicipios(filtros, ref.mes, filtros, { enabled: ref.resolvido })
  const navegar = useNavigate()
  const colunas = filtros.recorte === '342' ? BASE : [...BASE, ...CONTRATUAIS]
  const d = consulta.data

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-tela">Municípios</h1>
        <p className="subtitulo-tela">
          {d && <span className="font-medium text-slate-700">{mesAno(d.ano, d.mes)} · </span>}
          Saldos SIAFE e valores contratuais por município. Clique em um município para ver seus convênios.
        </p>
      </header>
      {consulta.isError ? (
        <CaixaErro erro={consulta.error} onTentar={() => void consulta.refetch()} onLimpar={limpar} />
      ) : !d ? (
        <Carregando />
      ) : (
        <>
          <TabelaPaginada
            colunas={colunas}
            itens={d.itens}
            chave={(i) => i.municipio}
            total={d.total}
            pagina={filtros.pagina}
            tamanho={TAMANHO_PAGINA}
            ordem={filtros.ordem}
            onOrdem={(ordem) => mudar({ ordem })}
            onPagina={(pagina) => mudar({ pagina })}
            onLinha={(i) => navegar(`/convenios${buscaGlobal(busca, { municipio: i.municipio })}`)}
            rotuloLinha={(i) => `Ver convênios de ${i.municipio}`}
            unidade={['município', 'municípios']}
            vazio="Nenhum município com convênio neste filtro."
            atualizando={consulta.isPlaceholderData}
          />
          <LegendaCompartilhado />
        </>
      )}
    </div>
  )
}
