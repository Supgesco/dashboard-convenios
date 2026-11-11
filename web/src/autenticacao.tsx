// Sessão do usuário, verificada pela API (/auth/*). O token fica num cookie HttpOnly que o JS não lê:
// nada de usuário, senha ou sessão fica no código nem no armazenamento do navegador.
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react'

import { ApiErro, aoNaoAutenticado, apiGet, apiPost, apiPostJson } from './api/cliente'
import { emModoEstatico } from './api/modoEstatico'

export interface Usuario {
  id: number
  email: string
  nome: string
  cargo: string | null
  orgao: string | null
  perfil: 'administrador' | 'analista' | 'auditor'
}

export type ResultadoLogin = { sucesso: true } | { sucesso: false; erro: string }

interface AuthContextoTipo {
  usuario: Usuario | null
  carregando: boolean
  login: (email: string, senha: string) => Promise<ResultadoLogin>
  logout: () => Promise<void>
}

// A publicação estática não tem API nem dados protegidos por servidor: entra direto como visitante.
const VISITANTE: Usuario = {
  id: 0,
  email: 'visitante@demonstracao',
  nome: 'Visitante (demonstração)',
  cargo: null,
  orgao: null,
  perfil: 'analista',
}

function mensagemDeErroLogin(e: unknown): string {
  if (e instanceof ApiErro) {
    if (e.status === 401) return 'E-mail ou senha inválidos.'
    if (e.status === 429) {
      return typeof e.detail === 'string' && e.detail
        ? e.detail
        : 'Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em alguns minutos.'
    }
    if (e.status === 0 || e.foraDaApi || e.status >= 500) {
      return 'Não foi possível falar com o serviço de autenticação. Tente novamente em instantes.'
    }
    return e.message
  }
  return 'Ocorreu um erro inesperado ao conectar ao serviço de autenticação.'
}

/** Chave da sessão no cache do TanStack Query (os testes a semeiam em `renderizar`). */
export const CHAVE_SESSAO = ['auth', 'me'] as const

/** Apaga do cache tudo que não é a sessão e grava a sessão nova (null = sem login). */
function trocarSessao(queryClient: QueryClient, usuario: Usuario | null) {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== CHAVE_SESSAO[0] })
  queryClient.setQueryData(CHAVE_SESSAO, usuario)
}

async function buscarSessao(): Promise<Usuario | null> {
  try {
    return await apiGet<Usuario>('/auth/me')
  } catch {
    // 401 = sem sessão. API fora do ar também cai no login, que mostra o erro ao tentar entrar.
    return null
  }
}

const AuthContexto = createContext<AuthContextoTipo | undefined>(undefined)

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const estatico = emModoEstatico()
  const queryClient = useQueryClient()
  const sessao = useQuery({
    queryKey: CHAVE_SESSAO,
    queryFn: buscarSessao,
    enabled: !estatico,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
  const usuario = estatico ? VISITANTE : (sessao.data ?? null)
  const carregando = !estatico && sessao.isPending

  // Sem sessão, nenhum dado em cache pode continuar visível (o próximo login pode ser de outra pessoa).
  const encerrarLocalmente = useCallback(() => trocarSessao(queryClient, null), [queryClient])

  // Qualquer 401 da API (sessão expirada ou encerrada) leva de volta ao login.
  useEffect(() => (estatico ? undefined : aoNaoAutenticado(encerrarLocalmente)), [estatico, encerrarLocalmente])

  const login = async (email: string, senha: string): Promise<ResultadoLogin> => {
    const e = email.trim().toLowerCase()
    if (!e || !senha) return { sucesso: false, erro: 'Informe o e-mail e a senha de acesso.' }
    if (estatico) return { sucesso: true }
    try {
      const u = await apiPostJson<Usuario>('/auth/login', { email: e, senha })
      trocarSessao(queryClient, u)
      return { sucesso: true }
    } catch (erro) {
      return { sucesso: false, erro: mensagemDeErroLogin(erro) }
    }
  }

  const logout = async () => {
    if (estatico) return
    encerrarLocalmente()
    await apiPost('/auth/logout').catch(() => undefined)
  }

  return (
    <AuthContexto.Provider value={{ usuario, carregando, login, logout }}>{children}</AuthContexto.Provider>
  )
}

export function useAuth() {
  const contexto = useContext(AuthContexto)
  if (!contexto) {
    throw new Error('useAuth deve ser utilizado dentro de um ProvedorAutenticacao')
  }
  return contexto
}
