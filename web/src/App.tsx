import { MotionConfig } from 'motion/react'
import { Link, Route, Routes } from 'react-router'

import { ProvedorAutenticacao } from './autenticacao'
import { Layout } from './componentes/Layout'
import { RotaProtegida } from './componentes/RotaProtegida'
import { ANIMAR } from './movimento'
import { TelaCargas } from './telas/Cargas'
import { TelaConvenios } from './telas/Convenios'
import { TelaDetalhe } from './telas/Detalhe'
import { TelaLogin } from './telas/Login'
import { TelaMunicipios } from './telas/Municipios'
import { TelaPrestacaoContas } from './telas/PrestacaoContas'
import { TelaTomadaContas } from './telas/TomadaContas'
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
  // Anima mesmo com "reduzir movimento" no sistema (ver `movimento.ts`).
  return (
    <ProvedorAutenticacao>
      <MotionConfig reducedMotion={ANIMAR ? 'never' : 'always'}>
        <Routes>
          <Route path="/login" element={<TelaLogin />} />
          <Route element={<RotaProtegida />}>
            <Route element={<Layout />}>
              <Route index element={<TelaVisaoGeral />} />
              <Route path="municipios" element={<TelaMunicipios />} />
              <Route path="convenios" element={<TelaConvenios />} />
              <Route path="prestacao-de-contas" element={<TelaPrestacaoContas />} />
              <Route path="tomada-de-contas" element={<TelaTomadaContas />} />
              <Route path="convenio" element={<TelaDetalhe />} />
              <Route path="cargas" element={<TelaCargas />} />
              <Route path="*" element={<NaoEncontrado />} />
            </Route>
          </Route>
        </Routes>
      </MotionConfig>
    </ProvedorAutenticacao>
  )
}
