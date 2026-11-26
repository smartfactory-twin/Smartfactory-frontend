import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuthContext } from '../../context/AuthContext'
import * as authService from '../../services/authService'

vi.mock('../../services/authService', () => ({
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}))

function AuthProbe() {
  const { loginWithGoogle, user, isAuthenticated } = useAuthContext()

  return (
    <>
      <button onClick={() => loginWithGoogle('simulated-google-credential').catch(() => {})}>Se connecter</button>
      <output>{isAuthenticated ? `Connecté : ${user.email}` : 'Non connecté'}</output>
    </>
  )
}

describe('AuthProvider — connexion Google', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    authService.loginWithGoogle.mockResolvedValue({ access: 'access-test', refresh: 'refresh-test' })
    authService.getMe.mockResolvedValue({ id: 8, email: 'technicien@smartfactory.tn', role: 'TECHNICIEN' })
  })

  it('stocke les jetons et charge le profil après une réponse valide', async () => {
    render(<AuthProvider><AuthProbe /></AuthProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Connecté : technicien@smartfactory.tn')).toBeInTheDocument()
    expect(authService.loginWithGoogle).toHaveBeenCalledWith('simulated-google-credential')
    expect(authService.getMe).toHaveBeenCalledOnce()
    expect(localStorage.getItem('sf_access')).toBe('access-test')
    expect(localStorage.getItem('sf_refresh')).toBe('refresh-test')
  })

  it('ne stocke aucun jeton si la vérification Google échoue', async () => {
    authService.loginWithGoogle.mockRejectedValue(new Error('Identité refusée'))
    render(<AuthProvider><AuthProbe /></AuthProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() => expect(screen.getByText('Non connecté')).toBeInTheDocument())
    expect(authService.getMe).not.toHaveBeenCalled()
    expect(localStorage.getItem('sf_access')).toBeNull()
    expect(localStorage.getItem('sf_refresh')).toBeNull()
  })
})
