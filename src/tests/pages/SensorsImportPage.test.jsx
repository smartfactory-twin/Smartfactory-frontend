import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SensorsImportPage from '../../pages/equipements/SensorsImportPage'
import { AuthContext } from '../../context/AuthContext'
import * as sensorService from '../../services/sensorService'

vi.mock('../../services/sensorService', () => ({
  importSensorsCsv: vi.fn(),
  previewSensorsCsv: vi.fn(),
}))

const PREVIEW_ITEMS = [
  {
    sensor_id: 'TEMP-CNC-101', name: 'Température CNC 101',
    machine_identifiant: 'CNC-101', type: 'TEMPERATURE', unit: '°C',
    frequency_seconds: 60, threshold_min: 10, threshold_max: 90, active: true,
  },
]

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
        <SensorsImportPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

async function selectFile(container) {
  const fileInput = container.querySelector('input[type="file"]')
  const file = new File(
    ['sensor_id,name,machine_identifiant,type,unit,frequency_seconds,threshold_min,threshold_max,active,description\n'],
    'capteurs.csv',
    { type: 'text/csv' }
  )
  await userEvent.upload(fileInput, file)
}

describe('SensorsImportPage — Module 3 (UC-08)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('prévisualise un CSV de capteurs sans créer de données', async () => {
    sensorService.previewSensorsCsv.mockResolvedValue({
      imported: 1, rejected: 0, duplicates: 0, errors: [], preview_items: PREVIEW_ITEMS,
    })

    const { container } = renderImport()
    await selectFile(container)
    await userEvent.click(screen.getByRole('button', { name: /prévisualiser/i }))

    await waitFor(() => {
      expect(sensorService.previewSensorsCsv).toHaveBeenCalledTimes(1)
    })
    expect(
      await screen.findByText(/prévisualisation — aucune donnée enregistrée/i)
    ).toBeInTheDocument()
    expect(screen.getByText('Capteurs importés')).toBeInTheDocument()
    // Aperçu des lignes à créer.
    expect(screen.getByText('TEMP-CNC-101')).toBeInTheDocument()
    expect(screen.getByText('CNC-101')).toBeInTheDocument()
    expect(screen.getByText('60s')).toBeInTheDocument()
    // Aucun import réel n'a été déclenché.
    expect(sensorService.importSensorsCsv).not.toHaveBeenCalled()
  })

  it('confirme l\'import et affiche le résumé des capteurs créés', async () => {
    sensorService.previewSensorsCsv.mockResolvedValue({
      imported: 1, rejected: 0, duplicates: 0, errors: [], preview_items: PREVIEW_ITEMS,
    })
    sensorService.importSensorsCsv.mockResolvedValue({
      imported: 2, rejected: 0, duplicates: 0, errors: [], preview_items: [],
    })

    const { container } = renderImport()
    await selectFile(container)
    await userEvent.click(screen.getByRole('button', { name: /prévisualiser/i }))
    await screen.findByText(/prévisualisation — aucune donnée enregistrée/i)

    await userEvent.click(screen.getByRole('button', { name: /confirmer l'import/i }))

    await waitFor(() => {
      expect(sensorService.importSensorsCsv).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('Import terminé')).toBeInTheDocument()
    expect(screen.getByText('Capteurs importés')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    // Les libellés de l'import de mesures ne doivent pas apparaître.
    expect(screen.queryByText('Mesures importées')).not.toBeInTheDocument()
    expect(screen.queryByText('Mesures rejetées')).not.toBeInTheDocument()
  })

  it('affiche les erreurs par ligne après prévisualisation', async () => {
    sensorService.previewSensorsCsv.mockResolvedValue({
      imported: 0,
      rejected: 2,
      duplicates: 1,
      errors: [
        { row: 1, message: 'sensor_id requis' },
        { row: 2, message: 'Machine introuvable : CNC-999' },
        { row: 3, message: 'Capteur déjà existant : TEMP-CNC-101' },
      ],
      preview_items: [],
    })

    const { container } = renderImport()
    await selectFile(container)
    await userEvent.click(screen.getByRole('button', { name: /prévisualiser/i }))

    expect(await screen.findByText(/Ligne 2 : Machine introuvable : CNC-999/)).toBeInTheDocument()
    expect(screen.getByText(/Capteur déjà existant : TEMP-CNC-101/)).toBeInTheDocument()
    expect(screen.getByText('Doublons')).toBeInTheDocument()
  })
})
