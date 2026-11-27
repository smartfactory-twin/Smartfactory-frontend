import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../../pages/auth/LoginPage'
import { AuthContext } from '../../context/AuthContext'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => navigate }))

function renderPage(loginWithGoogle = vi.fn().mockResolvedValue({ role: 'ADMIN' })) {
  return render(<AuthContext.Provider value={{ login: vi.fn(), loginWithGoogle, isLoading: false }}><MemoryRouter><LoginPage /></MemoryRouter></AuthContext.Provider>)
}

describe('Connexion Google', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    delete window.google
    navigate.mockClear()
  })

  it('affiche le bouton Google désactivé sans client ID', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Connexion avec Google — configuration requise' })).toBeDisabled()
    expect(screen.getByText('Connexion Google à configurer par l’administrateur.')).toBeInTheDocument()
  })

  it('transmet le credential reçu à AuthContext et redirige selon le rôle', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-test')
    let callback
    window.google = { accounts: { id: { initialize: vi.fn((options) => { callback = options.callback }), renderButton: vi.fn() } } }
    const loginWithGoogle = vi.fn().mockResolvedValue({ role: 'ADMIN' })
    renderPage(loginWithGoogle)

    await waitFor(() => expect(window.google.accounts.id.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'client-test' })))
    await act(async () => callback({ credential: 'google-id-token-test' }))

    expect(loginWithGoogle).toHaveBeenCalledWith('google-id-token-test')
    expect(navigate).toHaveBeenCalledWith('/admin/dashboard', { replace: true })
  })
})
