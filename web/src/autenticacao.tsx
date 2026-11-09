import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface Usuario {
  id: string
  email: string
  nome: string
  cargo: string
  orgao: string
  perfil: 'administrador' | 'analista' | 'auditor'
}

interface AuthContextoTipo {
  usuario: Usuario | null
  carregando: boolean
  login: (email: string, senha: string) => Promise<{ sucesso: boolean; erro?: string }>
  loginDemo: (perfil?: 'administrador' | 'analista') => void
  logout: () => void
}

const CHAVE_STORAGE = 'dashboard_convenios_usuario'

const SENHA_PADRAO = 'Seiop@1234'

const USUARIOS_PADRAO: Record<string, { senha: string; dados: Usuario }> = {
  'admin@obras.rj.gov.br': {
    senha: SENHA_PADRAO,
    dados: {
      id: 'usr_admin',
      email: 'admin@obras.rj.gov.br',
      nome: 'Coordenação SUBTSI',
      cargo: 'Subsecretaria de Tecnologia da Informação',
      orgao: 'SEIOP - Governo do Estado do Rio de Janeiro',
      perfil: 'administrador',
    },
  },
  'analista@obras.rj.gov.br': {
    senha: SENHA_PADRAO,
    dados: {
      id: 'usr_analista',
      email: 'analista@obras.rj.gov.br',
      nome: 'Analista de Convênios',
      cargo: 'Gestão de Convênios e Tomada de Contas',
      orgao: 'SEIOP - Governo do Estado do Rio de Janeiro',
      perfil: 'analista',
    },
  },
}

const EM_TESTE = import.meta.env.MODE === 'test'

const AuthContexto = createContext<AuthContextoTipo | undefined>(undefined)

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() =>
    EM_TESTE ? USUARIOS_PADRAO['admin@obras.rj.gov.br'].dados : null,
  )
  const [carregando, setCarregando] = useState(!EM_TESTE)

  useEffect(() => {
    if (EM_TESTE) return
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE)
      if (salvo) {
        setUsuario(JSON.parse(salvo))
      }
    } catch (e) {
      console.error('Falha ao carregar sessão salva', e)
    } finally {
      setCarregando(false)
    }
  }, [])

  const login = async (email: string, senha: string): Promise<{ sucesso: boolean; erro?: string }> => {
    const e = email.trim().toLowerCase()
    if (!e || !senha) {
      return { sucesso: false, erro: 'Informe o e-mail e a senha de acesso.' }
    }

    const conta = USUARIOS_PADRAO[e]
    if (!conta || conta.senha !== senha) {
      return { sucesso: false, erro: 'E-mail ou senha inválidos. Verifique suas credenciais.' }
    }

    setUsuario(conta.dados)
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(conta.dados))
    return { sucesso: true }
  }

  const loginDemo = (perfil: 'administrador' | 'analista' = 'administrador') => {
    const usr =
      perfil === 'administrador'
        ? USUARIOS_PADRAO['admin@obras.rj.gov.br'].dados
        : USUARIOS_PADRAO['analista@obras.rj.gov.br'].dados
    setUsuario(usr)
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(usr))
  }

  const logout = () => {
    setUsuario(null)
    localStorage.removeItem(CHAVE_STORAGE)
  }

  return (
    <AuthContexto.Provider value={{ usuario, carregando, login, loginDemo, logout }}>
      {children}
    </AuthContexto.Provider>
  )
}

export function useAuth() {
  const contexto = useContext(AuthContexto)
  if (!contexto) {
    throw new Error('useAuth deve ser utilizado dentro de um ProvedorAutenticacao')
  }
  return contexto
}
