import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MachineFormPage from '../../pages/machines/MachineFormPage'
import { AuthContext } from '../../context/AuthContext'
import * as machineService from '../../services/machineService'

vi.mock('../../services/machineService', () => ({
  getMachine: vi.fn(),
  createMachine: vi.fn(),
  updateMachine: vi.fn(),
  getUsines: vi.fn(),
  getZones: vi.fn(),
  getLignes: vi.fn(),
}))

const EXISTING_MACHINE = {
  id: 1,
  nom: 'Tour CNC',
  identifiant_interne: 'TC-004',
  numero_serie: 'SN-2024-001',
  marque: 'Siemens',
  modele: 'X200',
  date_installation: '2024-01-15',
  description: 'Machine de test',
  position_sur_plan: 'Zone B',
  statut: 'NORMAL',
  ligne_production: 1,
  photo: 'http://localhost:8000/media/machines/photos/tour.png',
}

function renderForm(route = '/machines/nouveau') {
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
          <Route path="/machines/nouveau" element={<MachineFormPage />} />
          <Route path="/machines/:id/edit" element={<MachineFormPage />} />
          <Route path="/machines" element={<div>Liste des machines</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

function makeFile(name = 'nouvelle.png') {
  return new File(['fake-image-bytes'], name, { type: 'image/png' })
}

describe('MachineFormPage — gestion de la photo', () => {
  beforeEach(() => {
    machineService.getUsines.mockResolvedValue({ results: [] })
    machineService.getZones.mockResolvedValue({ results: [] })
    machineService.getLignes.mockResolvedValue({ results: [] })
  })

  it("affiche la photo actuelle et propose de la changer en mode édition", async () => {
    machineService.getMachine.mockResolvedValue(EXISTING_MACHINE)
    renderForm('/machines/1/edit')

    const preview = await screen.findByAltText('Aperçu de la machine')
    expect(preview).toHaveAttribute('src', EXISTING_MACHINE.photo)
    expect(screen.getByText('Changer la photo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retirer/i })).toBeInTheDocument()
  })

  it('met à jour la machine avec une nouvelle photo (PATCH multipart)', async () => {
    machineService.getMachine.mockResolvedValue(EXISTING_MACHINE)
    machineService.updateMachine.mockResolvedValueOnce({ id: 1 })
    const { container } = renderForm('/machines/1/edit')

    await screen.findByAltText('Aperçu de la machine')

    const file = makeFile()
    fireEvent.change(container.querySelector('#photo-input'), { target: { files: [file] } })
    expect(await screen.findByAltText('Aperçu de la machine')).toHaveAttribute('src', 'blob:preview')

    await userEvent.click(screen.getByRole('button', { name: /mettre à jour/i }))

    await waitFor(() => expect(machineService.updateMachine).toHaveBeenCalledTimes(1))
    const [calledId, payload] = machineService.updateMachine.mock.calls[0]
    expect(calledId).toBe('1')
    expect(payload).toBeInstanceOf(FormData)
    expect(payload.get('photo')).toBe(file)
    expect(payload.get('nom')).toBe('Tour CNC')
  })

  it('met à jour les champs sans photo via PATCH JSON', async () => {
    machineService.getMachine.mockResolvedValue(EXISTING_MACHINE)
    machineService.updateMachine.mockResolvedValueOnce({ id: 1 })
    renderForm('/machines/1/edit')

    const nomInput = await screen.findByDisplayValue('Tour CNC')
    await userEvent.clear(nomInput)
    await userEvent.type(nomInput, 'Tour CNC 2')
    await userEvent.click(screen.getByRole('button', { name: /mettre à jour/i }))

    await waitFor(() => expect(machineService.updateMachine).toHaveBeenCalledTimes(1))
    const payload = machineService.updateMachine.mock.calls[0][1]
    expect(payload).not.toBeInstanceOf(FormData)
    expect(payload.nom).toBe('Tour CNC 2')
    expect(payload).not.toHaveProperty('photo')
  })

  it('permet de retirer la photo existante (photo = null)', async () => {
    machineService.getMachine.mockResolvedValue(EXISTING_MACHINE)
    machineService.updateMachine.mockResolvedValueOnce({ id: 1 })
    renderForm('/machines/1/edit')

    await screen.findByAltText('Aperçu de la machine')
    await userEvent.click(screen.getByRole('button', { name: /retirer/i }))

    // La prévisualisation disparaît
    expect(screen.queryByAltText('Aperçu de la machine')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /mettre à jour/i }))

    await waitFor(() => expect(machineService.updateMachine).toHaveBeenCalledTimes(1))
    const payload = machineService.updateMachine.mock.calls[0][1]
    expect(payload).not.toBeInstanceOf(FormData)
    expect(payload.photo).toBeNull()
  })

  it('joint une photo lors de la création (POST multipart)', async () => {
    machineService.createMachine.mockResolvedValueOnce({ id: 9 })
    const { container } = renderForm('/machines/nouveau')

    await userEvent.type(container.querySelector('input[name="nom"]'), 'Presse A1')
    await userEvent.type(container.querySelector('input[name="identifiant_interne"]'), 'MCH-A01')

    const file = makeFile('presse.jpg')
    fireEvent.change(container.querySelector('#photo-input'), { target: { files: [file] } })

    await userEvent.click(screen.getByRole('button', { name: /créer la machine/i }))

    await waitFor(() => expect(machineService.createMachine).toHaveBeenCalledTimes(1))
    const payload = machineService.createMachine.mock.calls[0][0]
    expect(payload).toBeInstanceOf(FormData)
    expect(payload.get('photo')).toBe(file)
    expect(payload.get('nom')).toBe('Presse A1')
    expect(payload.get('identifiant_interne')).toBe('MCH-A01')
  })

  it("affiche l'erreur renvoyée par l'API lors d'un échec d'envoi", async () => {
    machineService.getMachine.mockResolvedValue({ ...EXISTING_MACHINE, photo: null })
    machineService.updateMachine.mockRejectedValueOnce({
      response: { data: { identifiant_interne: ['Ce champ doit être unique.'] } },
    })
    renderForm('/machines/1/edit')

    await screen.findByDisplayValue('Tour CNC')
    await userEvent.click(screen.getByRole('button', { name: /mettre à jour/i }))

    expect(await screen.findByText(/ce champ doit être unique/i)).toBeInTheDocument()
  })
})
