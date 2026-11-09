import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProvedorAutenticacao } from '../autenticacao'
import { renderizar } from '../teste/render'
import { TelaLogin } from './Login'

describe('TelaLogin', () => {
  it('renderiza os campos de e-mail institucional e senha', () => {
    renderizar(
      <ProvedorAutenticacao>
        <TelaLogin />
      </ProvedorAutenticacao>,
      '/login',
    )

    expect(screen.getByRole('heading', { name: /Painel de Convênios/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/E-mail institucional/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Senha de acesso/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Acessar Painel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Admin SUBTSI/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Analista SEIOP/i })).toBeInTheDocument()
  })

  it('permite alternar visibilidade da senha', async () => {
    renderizar(
      <ProvedorAutenticacao>
        <TelaLogin />
      </ProvedorAutenticacao>,
      '/login',
    )

    const campoSenha = screen.getByLabelText(/Senha de acesso/i) as HTMLInputElement
    expect(campoSenha.type).toBe('password')

    const botaoAlternar = screen.getByLabelText(/Exibir senha/i)
    await userEvent.click(botaoAlternar)
    expect(campoSenha.type).toBe('text')

    const botaoOcultar = screen.getByLabelText(/Ocultar senha/i)
    await userEvent.click(botaoOcultar)
    expect(campoSenha.type).toBe('password')
  })

  it('permite login rápido pelos botões de demonstração', async () => {
    renderizar(
      <ProvedorAutenticacao>
        <TelaLogin />
      </ProvedorAutenticacao>,
      '/login',
    )

    const botaoAdmin = screen.getByRole('button', { name: /Admin SUBTSI/i })
    await userEvent.click(botaoAdmin)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="url"]')?.textContent).toBe('/')
    })
  })
})
