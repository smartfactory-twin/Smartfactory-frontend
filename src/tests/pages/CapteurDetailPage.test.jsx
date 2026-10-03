import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CapteurDetailPage from '../../pages/equipements/CapteurDetailPage'
import { AuthContext } from '../../context/AuthContext'
import * as sensorService from '../../services/sensorService'

vi.mock('../../services/sensorService', () => ({
  getCapteur: vi.fn(),
  getReadings: vi.fn(),
}))

const SENSOR = {
  id: 1, identifiant: 'TEMP-001', nom: 'Température Ligne A',
  type_capteur: 'TEMPERATURE', machine: 1, machine_nom: 'Tour CNC',
  machine_identifiant: 'TC-004', unite: '°C', frequence_mesure: 10,
  seuil_min: 0, seuil_max: 80, actif: true, description: 'Capteur de test',
}

function renderDetail(role = 'ADMIN') {
  const ctxValue = {
    user: { id: 1, email: 'admin@smartfactory.dz', role },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter initialEntries={['/capteurs/1']}>
        <Routes>
          <Route path="/capteurs/:id" element={<CapteurDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('CapteurDetailPage — Module 3 (UC-08)', () => {
  beforeEach(() => {
    sensorService.getCapteur.mockResolvedValue(SENSOR)
  })

  it('affiche les informations du capteur et ses dernières lectures', async () => {
    sensorService.getReadings.mockResolvedValue({
      count: 2,
      results: [
        { id: 1, valeur: 72.5, timestamp: '2026-10-03T10:00:00Z', hors_plage: false },
        { id: 2, valeur: 95, timestamp: '2026-10-03T10:05:00Z', hors_plage: true },
      ],
    })

    renderDetail()

    expect(await screen.findByText('Température Ligne A')).toBeInTheDocument()
    expect(screen.getByText('TEMP-001')).toBeInTheDocument()
    expect(screen.getByText('Tour CNC')).toBeInTheDocument()
    expect(screen.getByText('Dernières lectures')).toBeInTheDocument()
    expect(screen.getByText('72.5 °C')).toBeInTheDocument()
    expect(screen.getByText('95 °C')).toBeInTheDocument()
    // Valeur hors plage signalée
    expect(screen.getByTitle('Hors plage')).toBeInTheDocument()
  })

  it('affiche un message quand aucune lecture n\'est disponible', async () => {
    sensorService.getReadings.mockResolvedValue({ count: 0, results: [] })

    renderDetail()

    expect(await screen.findByText('Aucune lecture disponible')).toBeInTheDocument()
  })
})
