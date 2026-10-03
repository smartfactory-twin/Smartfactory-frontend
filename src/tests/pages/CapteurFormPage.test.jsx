import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CapteurFormPage from '../../pages/equipements/CapteurFormPage'
import { AuthContext } from '../../context/AuthContext'
import * as sensorService from '../../services/sensorService'
import * as machineService from '../../services/machineService'

vi.mock('../../services/sensorService', () => ({
  createCapteur: vi.fn(),
  updateCapteur: vi.fn(),
  getCapteur: vi.fn(),
}))
vi.mock('../../services/machineService', () => ({
  getMachines: vi.fn(),
}))

const MACHINES = [{ id: 1, nom: 'Tour CNC', identifiant_interne: 'TC-004' }]

const EXISTING_SENSOR = {
  id: 1, identifiant: 'TEMP-001', nom: 'Ancien nom', type_capteur: 'TEMPERATURE',
  machine: 1, unite: '°C', frequence_mesure: 10, seuil_min: 0, seuil_max: 80,
  actif: true, description: '',
}

function renderForm(route = '/capteurs/nouveau') {
  const ctxValue = {
    user: { id: 1, email: 'admin@smartfactory.dz', role: 'ADMIN' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/capteurs/nouveau" element={<CapteurFormPage />} />
          <Route path="/capteurs/:id/modifier" element={<CapteurFormPage />} />
          <Route path="/capteurs" element={<div>Liste des capteurs</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

async function fillCreateForm(container) {
  await screen.findByRole('option', { name: /Tour CNC/ })
  await userEvent.type(container.querySelector('input[name="identifiant"]'), 'TEMP-009')
  await userEvent.type(container.querySelector('input[name="nom"]'), 'Capteur Test')
  await userEvent.selectOptions(container.querySelector('select[name="machine"]'), '1')
  await userEvent.type(container.querySelector('input[name="unite"]'), '°C')
  await userEvent.type(container.querySelector('input[name="frequence_mesure"]'), '10')
  await userEvent.type(container.querySelector('input[name="seuil_min"]'), '0')
  await userEvent.type(container.querySelector('input[name="seuil_max"]'), '80')
}

describe('CapteurFormPage — Module 3 (UC-08)', () => {
  beforeEach(() => {
    machineService.getMachines.mockResolvedValue({ count: 1, results: MACHINES })
  })

  it('crée un capteur avec un payload valide', async () => {
    sensorService.createCapteur.mockResolvedValueOnce({ id: 9 })
    const { container } = renderForm()

    await fillCreateForm(container)
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))

    await waitFor(() => {
      expect(sensorService.createCapteur).toHaveBeenCalledTimes(1)
    })
    expect(sensorService.createCapteur).toHaveBeenCalledWith(expect.objectContaining({
      identifiant: 'TEMP-009',
      nom: 'Capteur Test',
      machine: 1,
      unite: '°C',
      frequence_mesure: 10,
      seuil_min: 0,
      seuil_max: 80,
    }))
  })

  it('affiche le message d\'erreur de validation renvoyé par l\'API', async () => {
    sensorService.createCapteur.mockRejectedValueOnce({
      response: {
        data: { seuil_min: ['Le seuil minimum doit être inférieur au seuil maximum.'] },
      },
    })
    const { container } = renderForm()

    await fillCreateForm(container)
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))

    expect(
      await screen.findByText(/le seuil minimum doit être inférieur/i)
    ).toBeInTheDocument()
  })

  it('charge un capteur existant et le met à jour en mode édition', async () => {
    sensorService.getCapteur.mockResolvedValueOnce(EXISTING_SENSOR)
    sensorService.updateCapteur.mockResolvedValueOnce({ id: 1 })
    renderForm('/capteurs/1/modifier')

    const nomInput = await screen.findByDisplayValue('Ancien nom')
    await userEvent.clear(nomInput)
    await userEvent.type(nomInput, 'Nouveau nom')

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(sensorService.updateCapteur).toHaveBeenCalledTimes(1)
    })
    expect(sensorService.updateCapteur).toHaveBeenCalledWith(
      '1', expect.objectContaining({ nom: 'Nouveau nom' })
    )
  })
})
