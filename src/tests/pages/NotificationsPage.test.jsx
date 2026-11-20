import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppRouter from '../../routes/AppRouter'
import { AuthContext } from '../../context/AuthContext'

vi.mock('../../pages/alertes/AlertesPage', () => ({
  default: () => <h1>Alertes regroupées</h1>,
}))

describe('Anciennes routes de notifications', () => {
  it('redirige le technicien vers la page Alertes centralisée', async () => {
    window.history.replaceState({}, '', '/technician/notifications')

    render(
      <AuthContext.Provider value={{
        user: { id: 1, email: 'tech@example.com', role: 'TECHNICIEN' },
        isAuthenticated: true,
        isLoading: false,
        logout: vi.fn(),
      }}>
        <AppRouter />
      </AuthContext.Provider>
    )

    expect(await screen.findByRole('heading', { name: 'Alertes regroupées' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/technician/alerts')
  })
})
