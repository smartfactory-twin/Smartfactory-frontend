import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import DashboardPage from '../../pages/admin/DashboardPage'
import { getUsines, getMachineStatusCounts } from '../../services/machineService'
import { getAlertDashboardStats, getAlerts } from '../../services/alertService'
import { listUsers } from '../../services/authService'
import { getUsineHierarchie } from '../../services/equipementService'

vi.mock('../../components/layout/AdminLayout', () => ({
  default: ({ children }) => <main>{children}</main>,
}))

vi.mock('../../services/machineService', () => ({
  getUsines: vi.fn(),
  getMachineStatusCounts: vi.fn(),
}))

vi.mock('../../services/alertService', () => ({
  getAlertDashboardStats: vi.fn(),
  getAlerts: vi.fn(),
}))

vi.mock('../../services/equipementService', () => ({
  getUsineHierarchie: vi.fn(),
}))

vi.mock('../../services/authService', () => ({
  listUsers: vi.fn(),
}))

describe('Admin Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUsines.mockResolvedValue({ count: 3, results: [
      { id: 1, nom: 'Usine A' }, { id: 2, nom: 'Usine B' }, { id: 3, nom: 'Usine C' },
    ] })
    getUsineHierarchie.mockImplementation((id) => Promise.resolve({ id, nom: `Usine ${id}`, zones: [], machines: [] }))
    getAlerts.mockResolvedValue({ count: 0, results: [] })
    getMachineStatusCounts.mockResolvedValue({
      total: 10,
      par_statut: { NORMAL: 6, DEGRADE: 2, CRITIQUE: 1, HORS_LIGNE: 1 },
    })
    listUsers.mockResolvedValue({ count: 5, results: [] })
    getAlertDashboardStats.mockResolvedValue({
      actives: 3,
      critiques: 1,
      par_niveau: { CRITIQUE: 2, MAJEURE: 3, MINEURE: 4, INFORMATION: 1 },
      par_jour: [],
    })
  })

  it('affiche des indicateurs et graphiques calculés depuis les statistiques API', async () => {
    render(
      <AuthContext.Provider value={{ user: { prenom: 'Nadia', actif: true } }}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(await screen.findByText('Bonjour, Nadia')).toBeInTheDocument()
    expect(screen.getByText(/3 sites industriels/)).toBeInTheDocument()
    expect(within(screen.getByText('Machines suivies').parentElement.parentElement).getByText('10')).toBeInTheDocument()
    expect(within(screen.getByText('Alertes actives').parentElement.parentElement).getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/6 comptes actifs/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Plan de l’usine' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alertes par niveau' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Évolution des alertes' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Répartition de 10 alertes par niveau/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /équipements par statut/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /alertes déclenchées chaque jour/ })).toBeInTheDocument()
    expect(getAlertDashboardStats).toHaveBeenCalledTimes(1)
    expect(getMachineStatusCounts).toHaveBeenCalledTimes(1)
  })
})
