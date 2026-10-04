import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SurveillancePage from '../../pages/operator/SurveillancePage'
import { AuthContext } from '../../context/AuthContext'
import * as machineService from '../../services/machineService'
import * as sensorService from '../../services/sensorService'

vi.mock('../../services/machineService', () => ({ getMachines: vi.fn() }))
vi.mock('../../services/sensorService', () => ({
  getCapteurs: vi.fn(),
  getReadings: vi.fn(),
}))

const MACHINE_CNC = {
  id: 1, nom: 'Tour CNC', identifiant_interne: 'CNC-101',
  statut: 'NORMAL', ligne_production: 1, ligne_production_nom: 'Ligne A',
}
const MACHINE_ROB = {
  id: 2, nom: 'Robot Soudure', identifiant_interne: 'ROB-201',
  statut: 'CRITIQUE', ligne_production: 2, ligne_production_nom: 'Ligne B',
}

const SENSOR_TEMP = {
  id: 1, identifiant: 'TEMP-CNC-101', nom: 'Température Carter',
  type_capteur: 'TEMPERATURE', machine: 1, unite: '°C',
  seuil_min: 20, seuil_max: 80, actif: true,
}
const SENSOR_VIB = {
  id: 2, identifiant: 'VIB-CNC-101', nom: 'Vibration Broche',
  type_capteur: 'VIBRATION', machine: 1, unite: 'mm/s',
  seuil_min: 0, seuil_max: 4.5, actif: true,
}
const SENSOR_RPM = {
  id: 3, identifiant: 'RPM-ROB-201', nom: 'Vitesse Rotation',
  type_capteur: 'VITESSE_RPM', machine: 2, unite: 'rpm',
  seuil_min: 0, seuil_max: 3000, actif: true,
}

const READING_OK = {
  id: 11, sensor: 1, valeur: 65.4, value: 65.4,
  timestamp: '2026-10-03T10:00:00Z', hors_plage: false,
}
const READING_OUT = {
  id: 12, sensor: 2, valeur: 7.8, value: 7.8,
  timestamp: '2026-10-03T10:05:00Z', hors_plage: true,
}

function renderPage(role = 'OPERATEUR') {
  const ctxValue = {
    user: { id: 9, email: 'op@smartfactory.dz', role, prenom: 'Sam', nom: 'Op' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter>
        <SurveillancePage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

function mockAll({ sensorsByMachine, readingsBySensor }) {
  machineService.getMachines.mockResolvedValue({
    count: sensorsByMachine ? Object.keys(sensorsByMachine).length : 0,
    results: Object.keys(sensorsByMachine ?? {}).map((id) => ({
      ...(id === '1' ? MACHINE_CNC : MACHINE_ROB),
    })),
  })
  sensorService.getCapteurs.mockImplementation(({ machine }) =>
    Promise.resolve({ count: 0, results: sensorsByMachine?.[machine] ?? [] })
  )
  sensorService.getReadings.mockImplementation(({ sensor }) => {
    const list = readingsBySensor?.[sensor] ?? []
    return Promise.resolve({ count: list.length, results: list })
  })
}

describe('SurveillancePage — OPERATEUR (consultation)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('ne affiche plus le message de module en développement', async () => {
    mockAll({
      sensorsByMachine: { 1: [SENSOR_TEMP], 2: [] },
      readingsBySensor: { 1: [READING_OK] },
    })
    renderPage()

    // "Tour CNC" apparaît dans la liste des machines et dans la colonne Machine.
    expect((await screen.findAllByText('Tour CNC')).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Module en cours de développement')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Surveillance' })).toBeInTheDocument()
  })

  it('affiche les machines, leur statut et leur dernière mesure', async () => {
    mockAll({
      sensorsByMachine: { 1: [SENSOR_TEMP], 2: [] },
      readingsBySensor: { 1: [READING_OK] },
    })
    renderPage()

    await screen.findAllByText('Tour CNC')
    // Identifiant interne + ligne (le capteur TEMP-CNC-101 contient aussi "CNC-101")
    expect(screen.getByText('CNC-101 · Ligne A')).toBeInTheDocument()
    expect(screen.getByText('ROB-201 · Ligne B')).toBeInTheDocument()
    // Statuts machine (4 statuts de la spec)
    expect(screen.getAllByText('Normal').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Critique').length).toBeGreaterThanOrEqual(1)
    // Dernière mesure + horodatage
    expect(screen.getByText(/Dernière mesure : 65.4 °C/)).toBeInTheDocument()
    expect(screen.getAllByText(/03\/10\/2026/).length).toBeGreaterThanOrEqual(1)
  })

  it('affiche les compteurs par statut', async () => {
    mockAll({
      sensorsByMachine: { 1: [SENSOR_TEMP], 2: [SENSOR_RPM] },
      readingsBySensor: { 1: [READING_OK], 3: [] },
    })
    renderPage()

    await screen.findByText('Machines normales')
    expect(screen.getByText('Machines normales')).toBeInTheDocument()
    expect(screen.getByText('Machines dégradées')).toBeInTheDocument()
    expect(screen.getByText('Machines critiques')).toBeInTheDocument()
    expect(screen.getByText('Machines hors ligne')).toBeInTheDocument()
  })

  it('affiche les capteurs avec type, valeur, unité et seuils', async () => {
    mockAll({
      sensorsByMachine: { 1: [SENSOR_TEMP, SENSOR_VIB], 2: [] },
      readingsBySensor: { 1: [READING_OK], 2: [READING_OUT] },
    })
    renderPage()

    await screen.findByText('Température Carter')
    expect(screen.getByText('TEMP-CNC-101')).toBeInTheDocument()
    expect(screen.getByText('Température')).toBeInTheDocument()
    expect(screen.getByText('Vibration')).toBeInTheDocument()
    // Valeurs + unités
    expect(screen.getByText('65.4')).toBeInTheDocument()
    expect(screen.getByText('°C')).toBeInTheDocument()
    expect(screen.getByText('mm/s')).toBeInTheDocument()
    // Seuils configurés du capteur
    expect(screen.getByText('20 – 80 °C')).toBeInTheDocument()
    expect(screen.getByText('0 – 4.5 mm/s')).toBeInTheDocument()
  })

  it('signale visuellement une valeur hors plage sans modifier le statut machine', async () => {
    mockAll({
      sensorsByMachine: { 1: [SENSOR_TEMP, SENSOR_VIB], 2: [] },
      readingsBySensor: { 1: [READING_OK], 2: [READING_OUT] },
    })
    renderPage()

    await screen.findByText('Vibration Broche')
    expect(screen.getByText('hors plage')).toBeInTheDocument()
    expect(screen.getByText(/valeur\(s\) hors plage détectée\(s\)/)).toBeInTheDocument()
    expect(
      screen.getByText(/Signalement visuel uniquement/)
    ).toBeInTheDocument()
    // Le statut de la machine reste celui du backend
    expect(screen.getAllByText('Normal').length).toBeGreaterThanOrEqual(1)
  })

  it('gère une machine sans aucune mesure', async () => {
    mockAll({
      sensorsByMachine: { 1: [SENSOR_TEMP], 2: [SENSOR_RPM] },
      readingsBySensor: { 1: [], 3: [] },
    })
    renderPage()

    await screen.findByText('Température Carter')
    expect(screen.getAllByText('Aucune mesure').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Aucune mesure disponible/).length).toBeGreaterThanOrEqual(1)
    // Aucune fausse valeur affichée
    expect(screen.queryByText('hors plage')).not.toBeInTheDocument()
  })

  it('filtre les capteurs en sélectionnant une machine', async () => {
    mockAll({
      sensorsByMachine: { 1: [SENSOR_TEMP, SENSOR_VIB], 2: [SENSOR_RPM] },
      readingsBySensor: { 1: [READING_OK], 2: [READING_OUT], 3: [] },
    })
    renderPage()

    await screen.findByText('Vitesse Rotation')
    // Tout est visible au départ
    expect(screen.getByText('Température Carter')).toBeInTheDocument()
    expect(screen.getByText('Vitesse Rotation')).toBeInTheDocument()

    // Sélectionne la machine CNC-101
    const machineButtons = screen.getAllByRole('button', { name: /CNC-101/ })
    await userEvent.click(machineButtons[0])

    await waitFor(() => {
      expect(screen.queryByText('Vitesse Rotation')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Température Carter')).toBeInTheDocument()
    expect(screen.getByText('Vibration Broche')).toBeInTheDocument()
  })

  it('affiche un état vide quand aucune machine n\'est accessible', async () => {
    machineService.getMachines.mockResolvedValue({ count: 0, results: [] })
    renderPage()

    expect(
      await screen.findByText(/Aucune machine accessible/i)
    ).toBeInTheDocument()
  })

  it('affiche un état vide quand aucun capteur n\'est disponible', async () => {
    mockAll({
      sensorsByMachine: { 1: [], 2: [] },
      readingsBySensor: {},
    })
    renderPage()

    await screen.findByText('Tour CNC')
    expect(
      await screen.findByText(/Aucun capteur disponible/i)
    ).toBeInTheDocument()
  })

  it('gère proprement une erreur API', async () => {
    machineService.getMachines.mockRejectedValue({
      response: { data: { detail: 'Service machines indisponible.' } },
    })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Service machines indisponible/i
    )
  })

  it('permet un rafraîchissement manuel des mesures', async () => {
    mockAll({
      sensorsByMachine: { 1: [SENSOR_TEMP], 2: [] },
      readingsBySensor: { 1: [READING_OK] },
    })
    renderPage()

    await screen.findAllByText('Tour CNC')
    const callsBefore = machineService.getMachines.mock.calls.length

    await userEvent.click(screen.getByTitle('Actualiser'))

    await waitFor(() => {
      expect(machineService.getMachines.mock.calls.length).toBeGreaterThan(callsBefore)
    })
    // Rafraîchissement des mesures également
    expect(sensorService.getReadings).toHaveBeenCalledWith(
      expect.objectContaining({ ordering: '-timestamp', limit: 1 })
    )
  })

  it('n\'expose aucune action de création, modification ou suppression', async () => {
    mockAll({
      sensorsByMachine: { 1: [SENSOR_TEMP], 2: [] },
      readingsBySensor: { 1: [READING_OK] },
    })
    renderPage()

    await screen.findAllByText('Tour CNC')
    expect(screen.queryByRole('button', { name: /ajouter/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /modifier/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /supprimer/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /importer/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/import csv/i)).not.toBeInTheDocument()
  })
})