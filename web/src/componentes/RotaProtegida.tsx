import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../autenticacao'
import { Carregando } from './Estados'

export function RotaProtegida() {
  const { usuario, carregando } = useAuth()
  const location = useLocation()

  if (carregando) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Carregando texto="Verificando autenticação…" />
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
