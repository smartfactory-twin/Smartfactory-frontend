import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../../pages/auth/LoginPage'
import { AuthContext } from '../../context/AuthContext'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderLoginPage(loginMock) {
  const ctxValue = {
    login:           loginMock ?? vi.fn(),
    logout:          vi.fn(),
    user:            null,
    isAuthenticated: false,
    isLoading:       false,
    refreshUser:     vi.fn(),
  }
  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

// helpers — placeholders exacts du composant
const getEmailInput    = () => screen.getByPlaceholderText('s.laurent@smartfactory.fr')
const getPasswordInput = () => screen.getByPlaceholderText('••••••••')
const getSubmitBtn     = () => screen.getByRole('button', { name: /se connecter/i })

describe('LoginPage', () => {

  beforeEach(() => mockNavigate.mockClear())

  it('affiche le formulaire de connexion', () => {
    renderLoginPage()
    expect(getEmailInput()).toBeInTheDocument()
    expect(getPasswordInput()).toBeInTheDocument()
    expect(getSubmitBtn()).toBeInTheDocument()
  })

  it('affiche une erreur si email vide', async () => {
    renderLoginPage()
    await userEvent.click(getSubmitBtn())
    await waitFor(() => {
      expect(screen.getByText(/adresse e-mail est obligatoire/i)).toBeInTheDocument()
    })
  })

  it('affiche une erreur si mot de passe vide', async () => {
    renderLoginPage()
    await userEvent.type(getEmailInput(), 'test@test.com')
    await userEvent.click(getSubmitBtn())
    await waitFor(() => {
      expect(screen.getByText(/mot de passe est obligatoire/i)).toBeInTheDocument()
    })
  })

  it('redirige vers /admin/dashboard après login ADMIN', async () => {
    const loginMock = vi.fn().mockResolvedValueOnce({ mustReset: false, role: 'ADMIN' })
    renderLoginPage(loginMock)
    await userEvent.type(getEmailInput(), 'admin@test.com')
    await userEvent.type(getPasswordInput(), 'password123')
    await userEvent.click(getSubmitBtn())
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard', { replace: true })
    })
  })

  it('redirige vers /technician/dashboard après login TECHNICIEN', async () => {
    const loginMock = vi.fn().mockResolvedValueOnce({ mustReset: false, role: 'TECHNICIEN' })
    renderLoginPage(loginMock)
    await userEvent.type(getEmailInput(), 'tech@test.com')
    await userEvent.type(getPasswordInput(), 'password123')
    await userEvent.click(getSubmitBtn())
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/technician/dashboard', { replace: true })
    })
  })

  it('redirige vers /operator/dashboard après login OPERATEUR', async () => {
    const loginMock = vi.fn().mockResolvedValueOnce({ mustReset: false, role: 'OPERATEUR' })
    renderLoginPage(loginMock)
    await userEvent.type(getEmailInput(), 'op@test.com')
    await userEvent.type(getPasswordInput(), 'password123')
    await userEvent.click(getSubmitBtn())
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/operator/dashboard', { replace: true })
    })
  })

  it('affiche une erreur 401 — identifiants invalides', async () => {
    const loginMock = vi.fn().mockRejectedValueOnce({ response: { status: 401 } })
    renderLoginPage(loginMock)
    await userEvent.type(getEmailInput(), 'bad@test.com')
    await userEvent.type(getPasswordInput(), 'wrongpass')
    await userEvent.click(getSubmitBtn())
    await waitFor(() => {
      expect(screen.getByText(/identifiants invalides/i)).toBeInTheDocument()
    })
  })

  it('affiche une erreur 403 — compte inactif', async () => {
    const loginMock = vi.fn().mockRejectedValueOnce({ response: { status: 403 } })
    renderLoginPage(loginMock)
    await userEvent.type(getEmailInput(), 'inactive@test.com')
    await userEvent.type(getPasswordInput(), 'password123')
    await userEvent.click(getSubmitBtn())
    await waitFor(() => {
      expect(screen.getByText(/compte est inactif/i)).toBeInTheDocument()
    })
  })

  it('affiche le ForceResetModal si must_reset_password=true', async () => {
    const loginMock = vi.fn().mockResolvedValueOnce({ mustReset: true, uid: 'abc', token: 'xyz' })
    renderLoginPage(loginMock)
    await userEvent.type(getEmailInput(), 'new@test.com')
    await userEvent.type(getPasswordInput(), 'temppass1')
    await userEvent.click(getSubmitBtn())
    await waitFor(() => {
      expect(screen.getByText(/changez votre mot de passe/i)).toBeInTheDocument()
    })
  })

  it('ne navigue pas si must_reset_password=true', async () => {
    const loginMock = vi.fn().mockResolvedValueOnce({ mustReset: true, uid: 'abc', token: 'xyz' })
    renderLoginPage(loginMock)
    await userEvent.type(getEmailInput(), 'new@test.com')
    await userEvent.type(getPasswordInput(), 'temppass1')
    await userEvent.click(getSubmitBtn())
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
