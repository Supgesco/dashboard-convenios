import type { ReactNode } from 'react'

import { ApiErro } from '../api/cliente'

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <p role="status" className="animate-pulse py-6 text-sm text-slate-500">
      {texto}
    </p>
  )
}

interface CaixaErroProps {
  erro: unknown
  onTentar?: () => void
  /** Quando o erro é de filtro (422), oferece limpar os filtros. */
  onLimpar?: () => void
  titulo?: string
}

export function CaixaErro({ erro, onTentar, onLimpar, titulo = 'Não foi possível carregar os dados' }: CaixaErroProps) {
  const mensagem = erro instanceof Error ? erro.message : 'Erro inesperado.'
  const de422 = erro instanceof ApiErro && erro.status === 422
  return (
    <div role="alert" className="my-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-medium">{titulo}</p>
      <p className="mt-1">{mensagem}</p>
      <div className="mt-3 flex gap-2">
        {onTentar && !de422 && (
          <button type="button" className="botao-secundario" onClick={onTentar}>
            Tentar de novo
          </button>
        )}
        {onLimpar && de422 && (
          <button type="button" className="botao-secundario" onClick={onLimpar}>
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="my-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {children}
    </p>
  )
}
