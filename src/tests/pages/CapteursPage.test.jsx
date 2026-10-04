import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CapteursPage from '../../pages/equipements/CapteursPage'
import { AuthContext } from '../../context/AuthContext'
import * as sensorService from '../../services/sensorService'
import * as machineService from '../../services/machineService'

vi.mock('../../services/sensorService', () => ({
  getCapteurs: vi.fn(),
  deleteCapteur: vi.fn(),
}))
vi.mock('../../services/machineService', () => ({
  getMachines: vi.fn(),
}))

const MACHINES = [
  { id: 1, nom: 'Tour CNC', identifiant_interne: 'TC-004' },
  { id: 2, nom: 'Presse hydraulique', identifiant_interne: 'PH-001' },
]

const SENSORS = [
  {
    id: 1, identifiant: 'TEMP-001', nom: 'Température Ligne A',
    type_capteur: 'TEMPERATURE', machine: 1, machine_nom: 'Tour CNC',
    machine_identifiant: 'TC-004', unite: '°C', frequence_mesure: 10,
    seuil_min: 0, seuil_max: 80, actif: true,
  },
  {
    id: 2, identifiant: 'VIB-001', nom: 'Vibration Ligne A',
    type_capteur: 'VIBRATION', machine: 1, machine_nom: 'Tour CNC',
    machine_identifiant: 'TC-004', unite: 'mm/s', frequence_mesure: 5,
    seuil_min: 0, seuil_max: 50, actif: false,
  },
  {
    id: 3, identifiant: 'PRES-001', nom: 'Pression Presse',
    type_capteur: 'PRESSION', machine: 2, machine_nom: 'Presse hydraulique',
    machine_identifiant: 'PH-001', unite: 'bar', frequence_mesure: 30,
    seuil_min: 0, seuil_max: 200, actif: true,
  },
]

function renderPage(role = 'ADMIN') {
  const ctxValue = {
    user: { id: 1, email: 'admin@smartfactory.dz', role },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter>
        <CapteursPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('CapteursPage — Module 3 (UC-08)', () => {
  beforeEach(() => {
    sensorService.getCapteurs.mockResolvedValue({ count: SENSORS.length, results: SENSORS })
    machineService.getMachines.mockResolvedValue({ count: MACHINES.length, results: MACHINES })
  })

  it('affiche la liste des capteurs avec leurs informations', async () => {
    renderPage()

    expect(await screen.findByText('Température Ligne A')).toBeInTheDocument()
    expect(screen.getByText('TEMP-001')).toBeInTheDocument()
    expect(screen.getByText('VIB-001')).toBeInTheDocument()
    expect(screen.getByText('PRES-001')).toBeInTheDocument()
    // Machine associée + unité + seuils
    expect(screen.getAllByText('Tour CNC').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('°C')).toBeInTheDocument()
    expect(screen.getByText('0 / 80 °C')).toBeInTheDocument()
    // Statut actif/inactif (uniquement dans le tableau, pas dans le filtre)
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('Actif').length).toBe(2)
    expect(within(table).getByText('Inactif')).toBeInTheDocument()
  })

  it('filtre les capteurs par type', async () => {
    renderPage()
    await screen.findByText('Température Ligne A')

    const typeSelect = screen.getAllByRole('combobox')[1]
    await userEvent.selectOptions(typeSelect, 'VIBRATION')

    expect(screen.getByText('Vibration Ligne A')).toBeInTheDocument()
    expect(screen.queryByText('Température Ligne A')).not.toBeInTheDocument()
    expect(screen.queryByText('Pression Presse')).not.toBeInTheDocument()
  })

  it('filtre les capteurs par machine', async () => {
    renderPage()
    await screen.findByText('Température Ligne A')

    const machineSelect = screen.getAllByRole('combobox')[0]
    await userEvent.selectOptions(machineSelect, '2')

    expect(screen.getByText('Pression Presse')).toBeInTheDocument()
    expect(screen.queryByText('Température Ligne A')).not.toBeInTheDocument()
    expect(screen.queryByText('Vibration Ligne A')).not.toBeInTheDocument()
  })

  it('filtre les capteurs par statut', async () => {
    renderPage()
    await screen.findByText('Température Ligne A')

    const statusSelect = screen.getAllByRole('combobox')[2]
    await userEvent.selectOptions(statusSelect, 'false')

    // Seul le capteur inactif (VIB-001) reste affiché.
    expect(screen.getByText('Vibration Ligne A')).toBeInTheDocument()
    expect(screen.queryByText('Température Ligne A')).not.toBeInTheDocument()
    expect(screen.queryByText('Pression Presse')).not.toBeInTheDocument()
  })

  it('recherche un capteur par identifiant', async () => {
    renderPage()
    await screen.findByText('Température Ligne A')

    const search = screen.getByPlaceholderText(/rechercher/i)
    await userEvent.type(search, 'VIB-001')

    expect(screen.getByText('Vibration Ligne A')).toBeInTheDocument()
    expect(screen.queryByText('Température Ligne A')).not.toBeInTheDocument()
    expect(screen.queryByText('Pression Presse')).not.toBeInTheDocument()
  })

  it('affiche un état vide quand aucun capteur n\'existe', async () => {
    sensorService.getCapteurs.mockResolvedValueOnce({ count: 0, results: [] })
    renderPage()

    expect(await screen.findByText('Aucun capteur trouvé.')).toBeInTheDocument()
  })

  it('affiche une erreur si le chargement échoue', async () => {
    sensorService.getCapteurs.mockRejectedValueOnce(new Error('network'))
    renderPage()

    expect(await screen.findByText('Impossible de charger les données.')).toBeInTheDocument()
  })

  it('affiche les boutons d\'ajout et d\'import pour l\'administrateur', async () => {
    renderPage('ADMIN')
    await screen.findByText('Température Ligne A')

    expect(screen.getByRole('button', { name: /ajouter un capteur/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /importer des capteurs/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /importer des mesures/i })).toBeInTheDocument()
  })

  it('masque les boutons d\'ajout et d\'import pour le technicien', async () => {
    renderPage('TECHNICIEN')
    await screen.findByText('Température Ligne A')

    expect(screen.queryByRole('button', { name: /ajouter un capteur/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /importer des capteurs/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /importer des mesures/i })).not.toBeInTheDocument()
  })

  it('supprime un capteur après confirmation (administrateur)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    sensorService.deleteCapteur.mockResolvedValueOnce({})

    renderPage('ADMIN')
    await screen.findByText('Température Ligne A')

    await userEvent.click(screen.getAllByTitle('Supprimer')[0])

    await waitFor(() => {
      expect(sensorService.deleteCapteur).toHaveBeenCalledWith(1)
    })
    confirmSpy.mockRestore()
  })
})
