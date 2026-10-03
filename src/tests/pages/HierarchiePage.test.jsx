import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import HierarchiePage from '../../pages/equipements/HierarchiePage'
import { AuthContext } from '../../context/AuthContext'
import * as equipementService from '../../services/equipementService'

// Mock services
vi.mock('../../services/equipementService', () => ({
  getUsines: vi.fn(),
  getUsineHierarchie: vi.fn(),
  exportHierarchyCsv: vi.fn(),
  previewHierarchyCsv: vi.fn(),
  importHierarchyCsv: vi.fn(),
}))

function renderHierarchiePage(role = 'ADMIN') {
  const ctxValue = {
    user: { id: 1, email: 'admin@smartfactory.fr', role },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }

  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter>
        <HierarchiePage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('HierarchiePage - Module 3 CSV Import/Export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    equipementService.getUsines.mockResolvedValue([
      { id: 1, nom: 'Usine Alger', adresse: 'Alger', zones_count: 2 },
    ])
  })

  it('affiche les boutons "Importer CSV" et "Exporter CSV" pour l\'administrateur', async () => {
    renderHierarchiePage('ADMIN')
    await waitFor(() => {
      expect(screen.getByText('Usine Alger')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /importer csv/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /exporter csv/i })).toBeInTheDocument()
  })

  it('masque les boutons "Importer CSV" et "Exporter CSV" pour le technicien', async () => {
    renderHierarchiePage('TECHNICIEN')
    await waitFor(() => {
      expect(screen.getByText('Usine Alger')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /importer csv/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /exporter csv/i })).not.toBeInTheDocument()
  })

  it('masque les boutons "Importer CSV" et "Exporter CSV" pour l\'opérateur', async () => {
    renderHierarchiePage('OPERATEUR')
    await waitFor(() => {
      expect(screen.getByText('Usine Alger')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /importer csv/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /exporter csv/i })).not.toBeInTheDocument()
  })

  it('déclenche l\'exportation CSV lors du clic sur "Exporter CSV"', async () => {
    equipementService.exportHierarchyCsv.mockResolvedValue(new Blob())
    renderHierarchiePage('ADMIN')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exporter csv/i })).toBeInTheDocument()
    })

    const exportBtn = screen.getByRole('button', { name: /exporter csv/i })
    await userEvent.click(exportBtn)

    expect(equipementService.exportHierarchyCsv).toHaveBeenCalledTimes(1)
  })

  it('ouvre la modale d\'import CSV lors du clic sur "Importer CSV"', async () => {
    renderHierarchiePage('ADMIN')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importer csv/i })).toBeInTheDocument()
    })

    const importBtn = screen.getByRole('button', { name: /importer csv/i })
    await userEvent.click(importBtn)

    expect(screen.getByText(/importer la hiérarchie des équipements/i)).toBeInTheDocument()
    expect(screen.getByText(/télécharger l'exemple csv/i)).toBeInTheDocument()
  })
})
