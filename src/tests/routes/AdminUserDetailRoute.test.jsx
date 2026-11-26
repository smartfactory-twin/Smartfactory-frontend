import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import AppRouter from '../../routes/AppRouter'
import { AuthContext } from '../../context/AuthContext'

vi.mock('../../pages/admin/UserDetailPage', () => ({ default: () => <h1>Détail utilisateur réservé</h1> }))

function renderAt(path, role) {
  window.history.pushState({}, '', path)
  return render(<AuthContext.Provider value={{ user: { role }, isAuthenticated: true, isLoading: false }}><AppRouter /></AuthContext.Provider>)
}

describe('route détail utilisateur ADMIN', () => {
  afterEach(() => { cleanup(); window.history.pushState({}, '', '/') })

  it('autorise un ADMIN sur /admin/users/:id', async () => {
    renderAt('/admin/users/46', 'ADMIN')
    expect(await screen.findByRole('heading', { name: 'Détail utilisateur réservé' })).toBeInTheDocument()
  })

  it.each(['TECHNICIEN', 'OPERATEUR'])('refuse la route à %s', async (role) => {
    renderAt('/admin/users/46', role)
    expect(await screen.findByText(/403 — Accès refusé/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Détail utilisateur réservé' })).not.toBeInTheDocument()
  })
})
