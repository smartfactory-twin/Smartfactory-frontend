import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ReadingsImportPage from '../../pages/equipements/ReadingsImportPage'
import { AuthContext } from '../../context/AuthContext'
import * as sensorService from '../../services/sensorService'

vi.mock('../../services/sensorService', () => ({
  importReadingsCsv: vi.fn(),
  importReadingsJson: vi.fn(),
  previewReadingsCsv: vi.fn(),
  previewReadingsJson: vi.fn(),
}))

function renderImport() {
  const ctxValue = {
    user: { id: 1, email: 'admin@smartfactory.dz', role: 'ADMIN' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter>
        <ReadingsImportPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('ReadingsImportPage — Module 3 (UC-09)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('importe un fichier CSV et affiche le résumé d\'import', async () => {
    sensorService.importReadingsCsv.mockResolvedValue({
      imported: 3, rejected: 0, duplicates: 0, errors: [],
    })

    const { container } = renderImport()

    const fileInput = container.querySelector('input[type="file"]')
    const file = new File(
      ['sensor_id,timestamp,value\nTEMP-001,2026-10-03T10:00:00Z,65.2\n'],
      'mesures.csv',
      { type: 'text/csv' }
    )
    await userEvent.upload(fileInput, file)
    await userEvent.click(screen.getByRole('button', { name: /importer csv/i }))

    await waitFor(() => {
      expect(sensorService.importReadingsCsv).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('Import terminé')).toBeInTheDocument()
    expect(screen.getByText('Mesures importées')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('signale un JSON invalide sans appeler l\'API', async () => {
    renderImport()

    await userEvent.click(screen.getByRole('button', { name: /import json/i }))
    const textarea = screen.getByPlaceholderText(/collez votre json/i)
    fireEvent.change(textarea, { target: { value: '{ ceci n\'est pas du json' } })

    await userEvent.click(screen.getByRole('button', { name: /importer json/i }))

    expect(await screen.findByText(/json invalide/i)).toBeInTheDocument()
    expect(sensorService.importReadingsJson).not.toHaveBeenCalled()
  })

  it('prévisualise un CSV sans enregistrer de données', async () => {
    sensorService.previewReadingsCsv.mockResolvedValue({
      imported: 2, rejected: 1, duplicates: 0,
      errors: [{ row: 3, message: 'Capteur introuvable : NOPE' }],
    })

    const { container } = renderImport()

    const fileInput = container.querySelector('input[type="file"]')
    const file = new File(
      ['sensor_id,timestamp,value\nTEMP-001,2026-10-03T10:00:00Z,65.2\n'],
      'mesures.csv',
      { type: 'text/csv' }
    )
    await userEvent.upload(fileInput, file)
    await userEvent.click(screen.getByRole('button', { name: /prévisualiser/i }))

    await waitFor(() => {
      expect(sensorService.previewReadingsCsv).toHaveBeenCalledTimes(1)
    })
    expect(
      await screen.findByText(/prévisualisation — aucune donnée enregistrée/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/capteur introuvable/i)).toBeInTheDocument()
    // Aucun import réel n'a été déclenché.
    expect(sensorService.importReadingsCsv).not.toHaveBeenCalled()
  })
})
