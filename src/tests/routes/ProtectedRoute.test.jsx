import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../../routes/ProtectedRoute'
import { AuthContext } from '../../context/AuthContext'

// Helper : rend ProtectedRoute avec un contexte auth simulé
function renderProtectedRoute({ isAuthenticated, isLoading, user, roles } = {}) {
  const ctxValue = {
    isAuthenticated: isAuthenticated ?? false,
    isLoading:       isLoading ?? false,
    user:            user ?? null,
    login:           vi.fn(),
    logout:          vi.fn(),
    refreshUser:     vi.fn(),
  }

  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<ProtectedRoute roles={roles} />}>
            <Route path="/protected" element={<div>Page protégée</div>} />
          </Route>
          <Route path="/login"        element={<div>Page login</div>} />
          <Route path="/unauthorized" element={<div>Non autorisé</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('ProtectedRoute', () => {

  it('affiche un spinner pendant le chargement', () => {
    renderProtectedRoute({ isLoading: true })
    // Le spinner est rendu — pas de redirection
    expect(screen.queryByText('Page protégée')).not.toBeInTheDocument()
    expect(screen.queryByText('Page login')).not.toBeInTheDocument()
  })

  it('redirige vers /login si non authentifié', () => {
    renderProtectedRoute({ isAuthenticated: false })
    expect(screen.getByText('Page login')).toBeInTheDocument()
    expect(screen.queryByText('Page protégée')).not.toBeInTheDocument()
  })

  it('affiche le contenu si authentifié sans restriction de rôle', () => {
    renderProtectedRoute({
      isAuthenticated: true,
      user: { id: 1, role: 'ADMIN' },
    })
    expect(screen.getByText('Page protégée')).toBeInTheDocument()
  })

  it('affiche le contenu si le rôle est autorisé', () => {
    renderProtectedRoute({
      isAuthenticated: true,
      user: { id: 1, role: 'TECHNICIEN' },
      roles: ['ADMIN', 'TECHNICIEN'],
    })
    expect(screen.getByText('Page protégée')).toBeInTheDocument()
  })

  it('redirige vers /unauthorized si le rôle n\'est pas autorisé', () => {
    renderProtectedRoute({
      isAuthenticated: true,
      user: { id: 1, role: 'OPERATEUR' },
      roles: ['ADMIN'],
    })
    expect(screen.getByText('Non autorisé')).toBeInTheDocument()
    expect(screen.queryByText('Page protégée')).not.toBeInTheDocument()
  })

  it('ADMIN peut accéder à une route ADMIN', () => {
    renderProtectedRoute({
      isAuthenticated: true,
      user: { id: 1, role: 'ADMIN' },
      roles: ['ADMIN'],
    })
    expect(screen.getByText('Page protégée')).toBeInTheDocument()
  })

  it('OPERATEUR ne peut pas accéder à une route ADMIN+TECHNICIEN', () => {
    renderProtectedRoute({
      isAuthenticated: true,
      user: { id: 1, role: 'OPERATEUR' },
      roles: ['ADMIN', 'TECHNICIEN'],
    })
    expect(screen.getByText('Non autorisé')).toBeInTheDocument()
  })
})
