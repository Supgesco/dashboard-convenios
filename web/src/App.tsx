import { Link, Route, Routes } from 'react-router'

import { Layout } from './componentes/Layout'
import { TelaCargas } from './telas/Cargas'
import { TelaConvenios } from './telas/Convenios'
import { TelaDetalhe } from './telas/Detalhe'
import { TelaMunicipios } from './telas/Municipios'
import { TelaVisaoGeral } from './telas/VisaoGeral'

function NaoEncontrado() {
  return (
    <section className="cartao">
      <h1 className="titulo-tela">Página não encontrada</h1>
      <p className="mt-2 text-sm text-slate-600">Este endereço não corresponde a nenhuma tela do painel.</p>
      <Link to="/" className="botao-link mt-3 inline-block">
        Ir para a Visão geral
      </Link>
    </section>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TelaVisaoGeral />} />
        <Route path="municipios" element={<TelaMunicipios />} />
        <Route path="convenios" element={<TelaConvenios />} />
        <Route path="convenio" element={<TelaDetalhe />} />
        <Route path="cargas" element={<TelaCargas />} />
        <Route path="*" element={<NaoEncontrado />} />
      </Route>
    </Routes>
  )
}
