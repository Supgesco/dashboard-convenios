import type { ReactNode } from 'react'

import { ApiErro } from '../api/cliente'

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div role="status" className="space-y-3 py-2">
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="esqueleto h-24" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <p className="text-sm text-slate-500">{texto}</p>
    </div>
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
    <div role="alert" className="my-3 animate-surgir rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
      <p className="flex items-center gap-2 font-semibold">
        <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-red-600 text-xs text-white">
          !
        </span>
        {titulo}
      </p>
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
    <p role="note" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span aria-hidden="true" className="mt-px font-semibold text-amber-700">
        ⚠
      </span>
      <span>{children}</span>
    </p>
  )
}
