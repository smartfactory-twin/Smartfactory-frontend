import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CapteurFormPage from '../../pages/equipements/CapteurFormPage'
import { AuthContext } from '../../context/AuthContext'
import * as sensors from '../../services/sensorService'
import * as machines from '../../services/machineService'

vi.mock('../../services/sensorService', () => ({ createCapteur: vi.fn(), updateCapteur: vi.fn(), getCapteur: vi.fn() }))
vi.mock('../../services/machineService', () => ({ getMachines: vi.fn() }))

function renderForm() {
  return render(<AuthContext.Provider value={{ user: { role: 'ADMIN' }, isAuthenticated: true, isLoading: false, logout: vi.fn() }}><MemoryRouter initialEntries={['/new']}><Routes><Route path="/new" element={<CapteurFormPage />} /><Route path="/capteurs" element={<div>Capteurs</div>} /></Routes></MemoryRouter></AuthContext.Provider>)
}

describe('CapteurFormPage — métadonnées IA', () => {
  beforeEach(() => { vi.clearAllMocks(); machines.getMachines.mockResolvedValue({ results: [{ id: 1, nom: 'Pompe', identifiant_interne: 'P-1' }] }) })
  it('désactive l’éligibilité pour un type non compatible et la réactive après une plage valide', async () => {
    renderForm()
    const eligible = screen.getByRole('checkbox', { name: /éligible pour l’IA/i })
    await userEvent.selectOptions(document.querySelector('select[name="type_capteur"]'), 'NIVEAU_SONORE')
    expect(eligible).toBeDisabled()
    await userEvent.selectOptions(document.querySelector('select[name="type_capteur"]'), 'TEMPERATURE')
    fireEvent.change(document.querySelector('input[name="seuil_min"]'), { target: { value: '10' } })
    fireEvent.change(document.querySelector('input[name="seuil_max"]'), { target: { value: '80' } })
    expect(eligible).toBeEnabled()
  })
  it('refuse une plage inversée et associe la plage renseignée aux seuils', async () => {
    sensors.createCapteur.mockResolvedValueOnce({ id: 5 })
    renderForm()
    await screen.findByRole('option', { name: /Pompe/ })
    const input = (selector) => document.querySelector(selector)
    await userEvent.type(input('input[name="identifiant"]'), 'T-5')
    await userEvent.type(input('input[name="nom"]'), 'Température')
    await userEvent.selectOptions(input('select[name="machine"]'), '1')
    await userEvent.type(input('input[name="frequence_mesure"]'), '60')
    fireEvent.change(input('input[name="seuil_min"]'), { target: { value: '90' } })
    fireEvent.change(input('input[name="seuil_max"]'), { target: { value: '80' } })
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    expect(await screen.findByText(/seuil minimum doit être inférieur au seuil maximum/)).toBeInTheDocument()
    expect(sensors.createCapteur).not.toHaveBeenCalled()
    fireEvent.change(input('input[name="seuil_min"]'), { target: { value: '10' } })
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    await waitFor(() => expect(sensors.createCapteur).toHaveBeenCalledOnce())
    expect(sensors.createCapteur).toHaveBeenCalledWith(expect.objectContaining({ seuil_min: 10, seuil_max: 80, sensor_role: 'temperature', nominal_min: 10, nominal_max: 80, is_ai_eligible: false }))
  })

  it('convertit les seuils laissés vides en null', async () => {
    sensors.createCapteur.mockResolvedValueOnce({ id: 6 })
    renderForm()
    await screen.findByRole('option', { name: /Pompe/ })
    const input = (selector) => document.querySelector(selector)
    await userEvent.type(input('input[name="identifiant"]'), 'T-6')
    await userEvent.type(input('input[name="nom"]'), 'Température sans seuil')
    await userEvent.selectOptions(input('select[name="machine"]'), '1')
    await userEvent.type(input('input[name="frequence_mesure"]'), '60')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    await waitFor(() => expect(sensors.createCapteur).toHaveBeenCalledOnce())
    expect(sensors.createCapteur).toHaveBeenCalledWith(expect.objectContaining({ seuil_min: null, seuil_max: null, nominal_min: null, nominal_max: null, sensor_role: 'temperature', is_ai_eligible: false }))
  })
})
