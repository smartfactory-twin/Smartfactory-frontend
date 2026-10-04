import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AlertesPage from '../../pages/alertes/AlertesPage'
import { AuthContext } from '../../context/AuthContext'
import * as alertService from '../../services/alertService'
import * as notificationService from '../../services/notificationService'
import * as machineService from '../../services/machineService'

vi.mock('../../services/alertService', () => ({
  getAlerts: vi.fn(),
  getAlert: vi.fn(),
  acknowledgeAlert: vi.fn(),
  prepareOtFromAlert: vi.fn(),
}))

vi.mock('../../services/notificationService', () => ({
  getNotifications: vi.fn(),
  getNotificationCount: vi.fn(),
  markAllAsRead: vi.fn(),
  markAsRead: vi.fn(),
}))

vi.mock('../../services/machineService', () => ({
  getMachines: vi.fn(),
}))

const ALERTS = [
  {
    id: 1,
    reference: 'AL-000001',
    niveau: 'CRITIQUE',
    niveau_label: 'Critique',
    statut: 'ACTIVE',
    statut_label: 'Active',
    machine: 10,
    machine_nom: 'CNC-101',
    capteur: 20,
    capteur_identifiant: 'TEMP-CNC-101',
    valeur: 105,
    seuil: 90,
    unite: '°C',
    message: 'Température supérieure au seuil maximum.',
    date_declenchement: '2026-10-03T10:05:00Z',
    est_ouverte: true,
  },
  {
    id: 2,
    reference: 'AL-000002',
    niveau: 'MAJEURE',
    niveau_label: 'Majeure',
    statut: 'ACKNOWLEDGED',
    statut_label: 'Acquittée',
    machine: 11,
    machine_nom: 'PRS-105',
    capteur: 21,
    capteur_identifiant: 'PRES-PRS-105',
    valeur: 280,
    seuil: 250,
    unite: 'bar',
    message: 'Pression élevée.',
    date_declenchement: '2026-10-03T09:30:00Z',
    est_ouverte: false,
  },
]

const NOTIFICATIONS = [
  {
    id: 99,
    titre: 'CRITIQUE — CNC-101',
    machine_nom: 'CNC-101',
    niveau: 'CRITIQUE',
    niveau_label: 'Critique',
    message: 'Température supérieure au seuil maximum.',
    date_creation: '2026-10-03T10:05:00Z',
    lue: false,
    alerte: 1,
  },
]

function renderPage(role = 'ADMIN', initialPath = '/') {
  const ctxValue = {
    user: { id: 1, email: 'admin@smartfactory.dz', role },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }

  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AlertesPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('AlertesPage', () => {
  beforeEach(() => {
    alertService.getAlerts.mockResolvedValue({ count: ALERTS.length, results: ALERTS })
    alertService.getAlert.mockImplementation(async (id) => ALERTS.find((a) => a.id === Number(id)))
    alertService.acknowledgeAlert.mockResolvedValue({ ok: true })
    alertService.prepareOtFromAlert.mockResolvedValue({
      machine: 10,
      machine_nom: 'CNC-101',
      capteur: 20,
      capteur_identifiant: 'TEMP-CNC-101',
      valeur: 105,
      niveau: 'CRITIQUE',
      description: 'Température supérieure au seuil maximum.',
    })

    notificationService.getNotifications.mockResolvedValue({ count: NOTIFICATIONS.length, results: NOTIFICATIONS })
    notificationService.getNotificationCount.mockResolvedValue({ non_lues: 1 })
    notificationService.markAllAsRead.mockResolvedValue({ mises_a_jour: 1 })
    notificationService.markAsRead.mockResolvedValue({ ok: true })

    machineService.getMachines.mockResolvedValue({ count: 2, results: [{ id: 10, nom: 'CNC-101' }, { id: 11, nom: 'PRS-105' }] })
  })

  it('affiche la liste des alertes et le badge des notifications', async () => {
    renderPage('ADMIN')

    const cncNodes = await screen.findAllByText('CNC-101')
    expect(cncNodes.length).toBeGreaterThan(0)
    expect(screen.getAllByText('PRS-105').length).toBeGreaterThan(0)
    expect(screen.getByText('CRITIQUE — CNC-101')).toBeInTheDocument()
  })

  it('filtre et recherche les alertes', async () => {
    renderPage('TECHNICIEN')

    await screen.findAllByText('CNC-101')

    const searchInput = screen.getByPlaceholderText(/recherche par machine, capteur, référence/i)
    await userEvent.type(searchInput, 'PRS-105')

    await waitFor(() => {
      expect(screen.getAllByText('PRS-105').length).toBeGreaterThan(0)
    })

    const levelSelect = screen.getAllByRole('combobox')[0]
    await userEvent.selectOptions(levelSelect, 'MAJEURE')

    await waitFor(() => {
      expect(screen.getAllByText('PRS-105').length).toBeGreaterThan(0)
    })
  })

  it('ouvre le détail et exige un commentaire obligatoire avant acquittement', async () => {
    renderPage('OPERATEUR')

    const detailBtn = (await screen.findAllByRole('button', { name: /détail/i }))[0]
    await userEvent.click(detailBtn)

    const messageNodes = await screen.findAllByText(/Température supérieure au seuil maximum/i)
    expect(messageNodes.length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /acquitter/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /acquitter/i }))

    const confirmButton = screen.getByRole('button', { name: /confirmer/i })
    expect(confirmButton).toBeDisabled()

    await userEvent.type(screen.getByPlaceholderText(/inspection visuelle effectuée/i), 'Inspection visuelle effectuée.')
    expect(confirmButton).not.toBeDisabled()
  })

  it('ne propose pas l’acquittement d’une alerte déjà acquittée', async () => {
    renderPage('TECHNICIEN')

    const detailButtons = await screen.findAllByRole('button', { name: /détail/i })
    await userEvent.click(detailButtons[1])

    await screen.findByText('Alerte #AL-000002')
    expect(screen.queryByRole('button', { name: /acquitter/i })).not.toBeInTheDocument()
  })

  it('ouvre le détail demandé dans le lien de notification', async () => {
    renderPage('OPERATEUR', '/operator/alerts?alerte=1')

    expect(await screen.findByText('Alerte #AL-000001')).toBeInTheDocument()
    expect(alertService.getAlert).toHaveBeenCalledWith('1')
  })

  it('ne montre pas la préparation OT à un opérateur', async () => {
    renderPage('OPERATEUR')

    const detailButtons = await screen.findAllByRole('button', { name: /détail/i })
    await userEvent.click(detailButtons[0])

    await screen.findByText('Alerte #AL-000001')
    expect(screen.queryByRole('button', { name: /créer un ordre de travail/i })).not.toBeInTheDocument()
  })

  it('acquitte une alerte avec commentaire puis prépare un OT', async () => {
    renderPage('TECHNICIEN')

    const detailBtn = (await screen.findAllByRole('button', { name: /détail/i }))[0]
    await userEvent.click(detailBtn)
    await userEvent.click(screen.getByRole('button', { name: /acquitter/i }))
    await userEvent.type(screen.getByPlaceholderText(/inspection visuelle effectuée/i), 'Inspection visuelle effectuée.')
    await userEvent.click(screen.getByRole('button', { name: /confirmer/i }))

    await waitFor(() => {
      expect(alertService.acknowledgeAlert).toHaveBeenCalledWith(1, 'Inspection visuelle effectuée.')
    })

    await userEvent.click(screen.getByRole('button', { name: /créer un ordre de travail/i }))
    await waitFor(() => {
      expect(alertService.prepareOtFromAlert).toHaveBeenCalledWith(1)
    })
  })

  it('affiche les notifications et les marque comme lues', async () => {
    renderPage('OPERATEUR')

    const notification = await screen.findByText('CRITIQUE — CNC-101')
    expect(notification).toBeInTheDocument()

    await userEvent.click(notification)
    await waitFor(() => {
      expect(notificationService.markAsRead).toHaveBeenCalledWith(99)
    })
    expect(await screen.findByText('Alerte #AL-000001')).toBeInTheDocument()
    expect(alertService.getAlert).toHaveBeenCalledWith(1)
  })

  it('affiche un état vide sans alerte', async () => {
    alertService.getAlerts.mockResolvedValueOnce({ count: 0, results: [] })
    renderPage('ADMIN')

    expect(await screen.findByText(/aucune alerte/i)).toBeInTheDocument()
  })
})
