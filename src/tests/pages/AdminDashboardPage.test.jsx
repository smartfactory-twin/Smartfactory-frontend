import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AuthContext } from '../../context/AuthContext'
import DashboardPage from '../../pages/admin/DashboardPage'
import { getUsines, getMachines } from '../../services/machineService'
import { getAlertStats } from '../../services/alertService'
import { listUsers } from '../../services/authService'

vi.mock('../../components/layout/AdminLayout', () => ({
  default: ({ children }) => <main>{children}</main>,
}))

vi.mock('../../services/machineService', () => ({
  getUsines: vi.fn(),
  getMachines: vi.fn(),
}))

vi.mock('../../services/alertService', () => ({
  getAlertStats: vi.fn(),
}))

vi.mock('../../services/authService', () => ({
  listUsers: vi.fn(),
}))

describe('Admin Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUsines.mockResolvedValue({ count: 3, results: [] })
    getMachines.mockImplementation(({ statut }) => Promise.resolve({
      count: { NORMAL: 6, DEGRADE: 2, CRITIQUE: 1, HORS_LIGNE: 1 }[statut],
      results: [],
    }))
    listUsers.mockResolvedValue({ count: 5, results: [] })
    getAlertStats.mockImplementation((params) => Promise.resolve(
      params
        ? { total: 2 }
        : {
            actives: 3,
            critiques: 1,
            par_niveau: { CRITIQUE: 2, MAJEURE: 3, MINEURE: 4, INFORMATION: 1 },
          }
    ))
  })

  it('affiche des indicateurs et graphiques calculés depuis les statistiques API', async () => {
    render(
      <AuthContext.Provider value={{ user: { prenom: 'Nadia', actif: true } }}>
        <DashboardPage />
      </AuthContext.Provider>
    )

    expect(await screen.findByText('Bonjour, Nadia')).toBeInTheDocument()
    expect(within(screen.getByText('Sites industriels').parentElement.parentElement).getByText('3')).toBeInTheDocument()
    expect(within(screen.getByText('Équipements').parentElement.parentElement).getByText('10')).toBeInTheDocument()
    expect(screen.getByText('Santé opérationnelle : 60%')).toBeInTheDocument()
    expect(within(screen.getByText('Alertes actives').parentElement.parentElement).getByText('3')).toBeInTheDocument()
    expect(within(screen.getByText('Utilisateurs actifs').parentElement.parentElement).getByText('6')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'État des équipements' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alertes par niveau' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Évolution des alertes' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Répartition de 10 alertes par niveau/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /équipements par statut/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /alertes déclenchées chaque jour/ })).toBeInTheDocument()
    expect(getAlertStats).toHaveBeenCalledTimes(8)
  })
})
