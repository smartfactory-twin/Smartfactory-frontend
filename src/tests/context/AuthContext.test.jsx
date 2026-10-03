import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuthContext } from '../../context/AuthContext'

// ── Mock des services ─────────────────────────────────────────────────────────
vi.mock('../../services/authService', () => ({
  login:  vi.fn(),
  logout: vi.fn(),
  getMe:  vi.fn(),
}))

import { login as loginService, logout as logoutService, getMe } from '../../services/authService'

// Composant helper pour accéder au contexte dans les tests
function TestConsumer() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuthContext()
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <span data-testid="role">{user?.role ?? 'null'}</span>
      <span data-testid="photo">{user?.photo ?? 'null'}</span>
      <button onClick={() => login('test@test.com', 'password')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  )
}

describe('AuthContext', () => {

  describe('Initialisation', () => {
    it('isLoading=false après montage sans token', async () => {
      // Pas de token → getMe n'est pas appelé
      renderWithProvider()
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false')
      })
      expect(screen.getByTestId('auth')).toHaveTextContent('false')
    })

    it('re-hydrate depuis localStorage si token présent', async () => {
      localStorage.setItem('sf_access', 'fake-token')
      getMe.mockResolvedValueOnce({
        id: 1, email: 'admin@test.com', role: 'ADMIN',
        nom: 'Admin', prenom: 'Test', photo: '/media/profiles/photo.jpg'
      })

      renderWithProvider()

      await waitFor(() => {
        expect(screen.getByTestId('auth')).toHaveTextContent('true')
      })
      expect(screen.getByTestId('user')).toHaveTextContent('admin@test.com')
      expect(screen.getByTestId('photo')).toHaveTextContent('/media/profiles/photo.jpg')
    })

    it('nettoie localStorage si getMe échoue au montage', async () => {
      localStorage.setItem('sf_access', 'expired-token')
      localStorage.setItem('sf_refresh', 'expired-refresh')
      getMe.mockRejectedValueOnce(new Error('401'))

      renderWithProvider()

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false')
      })
      expect(localStorage.getItem('sf_access')).toBeNull()
      expect(localStorage.getItem('sf_refresh')).toBeNull()
      expect(screen.getByTestId('auth')).toHaveTextContent('false')
    })
  })

  describe('Login', () => {
    it('login normal stocke les tokens et charge le profil complet', async () => {
      // Pas de token au montage → getMe non appelé au useEffect
      loginService.mockResolvedValueOnce({
        access: 'access-token',
        refresh: 'refresh-token',
        user: { id: 1, email: 'tech@test.com', role: 'TECHNICIEN' },
      })
      // getMe appelé UNE fois dans login()
      getMe.mockResolvedValueOnce({
        id: 1, email: 'tech@test.com', role: 'TECHNICIEN',
        nom: 'Rezgui', prenom: 'Sirine', photo: '/media/profiles/photo.jpg'
      })

      renderWithProvider()
      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

      await act(async () => {
        await userEvent.click(screen.getByText('login'))
      })

      expect(localStorage.getItem('sf_access')).toBe('access-token')
      expect(localStorage.getItem('sf_refresh')).toBe('refresh-token')
      expect(screen.getByTestId('auth')).toHaveTextContent('true')
      expect(screen.getByTestId('user')).toHaveTextContent('tech@test.com')
      expect(screen.getByTestId('photo')).toHaveTextContent('/media/profiles/photo.jpg')
    })

    it('la photo est disponible dès le login sans refresh de page', async () => {
      // Pas de token au montage — getMe non appelé dans useEffect
      loginService.mockResolvedValueOnce({
        access: 'tok', refresh: 'ref',
        user: { id: 2, email: 'op@test.com', role: 'OPERATEUR' },
      })
      getMe.mockResolvedValueOnce({
        id: 2, email: 'op@test.com', role: 'OPERATEUR',
        nom: 'Ben', prenom: 'Ali', photo: '/media/profiles/avatar.png'
      })

      renderWithProvider()
      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

      await act(async () => {
        await userEvent.click(screen.getByText('login'))
      })

      // Photo disponible IMMÉDIATEMENT après login (via getMe dans login())
      expect(screen.getByTestId('photo')).toHaveTextContent('/media/profiles/avatar.png')
    })

    it('must_reset_password : getMe non appelé', async () => {
      loginService.mockResolvedValueOnce({
        must_reset_password: true,
        uid: 'abc123',
        token: 'reset-token',
      })

      // On teste que getMe n'est PAS appelé quand must_reset=true
      renderWithProvider()
      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

      await act(async () => {
        await userEvent.click(screen.getByText('login'))
      })

      expect(getMe).not.toHaveBeenCalled()
    })
  })

  describe('Logout', () => {
    it('logout supprime les tokens et réinitialise le user', async () => {
      localStorage.setItem('sf_access', 'tok')
      localStorage.setItem('sf_refresh', 'ref')
      getMe.mockResolvedValueOnce({
        id: 1, email: 'admin@test.com', role: 'ADMIN',
        nom: 'A', prenom: 'B', photo: null
      })
      logoutService.mockResolvedValueOnce({})

      renderWithProvider()
      await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('true'))

      await act(async () => {
        await userEvent.click(screen.getByText('logout'))
      })

      expect(localStorage.getItem('sf_access')).toBeNull()
      expect(localStorage.getItem('sf_refresh')).toBeNull()
      expect(screen.getByTestId('auth')).toHaveTextContent('false')
      expect(screen.getByTestId('user')).toHaveTextContent('null')
    })

    it('logout côté client même si le serveur échoue', async () => {
      localStorage.setItem('sf_access', 'tok')
      localStorage.setItem('sf_refresh', 'ref')
      getMe.mockResolvedValueOnce({
        id: 1, email: 'x@x.com', role: 'ADMIN',
        nom: 'A', prenom: 'B', photo: null
      })
      logoutService.mockRejectedValueOnce(new Error('network error'))

      renderWithProvider()
      await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('true'))

      await act(async () => {
        await userEvent.click(screen.getByText('logout'))
      })

      expect(screen.getByTestId('auth')).toHaveTextContent('false')
      expect(localStorage.getItem('sf_access')).toBeNull()
    })
  })
})
