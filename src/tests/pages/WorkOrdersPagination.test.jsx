import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import WorkOrdersPage from '../../pages/maintenance/WorkOrdersPage'
import { AuthContext } from '../../context/AuthContext'
import * as workOrderService from '../../services/workOrderService'
import * as machineService from '../../services/machineService'

vi.mock('../../services/workOrderService', () => ({ getWorkOrders: vi.fn(), getRecurring: vi.fn(), createWorkOrder: vi.fn(), updateWorkOrderStatus: vi.fn(), submitReport: vi.fn(), addRecurring: vi.fn() }))
vi.mock('../../services/machineService', () => ({ getMachines: vi.fn() }))
vi.mock('../../components/layout/AdminLayout', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../components/layout/TechnicianLayout', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../components/layout/OperatorLayout', () => ({ default: ({ children }) => <main>{children}</main> }))

const order = (id) => ({ id, titre: `Intervention machine ${id}`, machine_nom: `Presse ${id}`, statut: 'Créé', priorite: 'Haute', type: 'Corrective', assigne: 'Technicien' })
function renderPage() {
  return render(<AuthContext.Provider value={{ user: { role: 'ADMIN' } }}><MemoryRouter><WorkOrdersPage /></MemoryRouter></AuthContext.Provider>)
}

describe('pagination des ordres de travail', () => {
  beforeEach(() => {
    workOrderService.getWorkOrders.mockResolvedValue(Array.from({ length: 11 }, (_, i) => order(i + 1)))
    workOrderService.getRecurring.mockResolvedValue([])
    machineService.getMachines.mockResolvedValue({ results: [] })
  })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('navigue entre les pages et bloque aux première et dernière pages', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Intervention machine 1')).toBeInTheDocument()
    expect(screen.queryByText('Intervention machine 11')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /précédent/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /suivant/i }))
    expect(await screen.findByText('Intervention machine 11')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /suivant/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /précédent/i }))
    expect(await screen.findByText('Intervention machine 1')).toBeInTheDocument()
  })

  it('ne montre pas de pagination pour une liste vide', async () => {
    workOrderService.getWorkOrders.mockResolvedValueOnce([])
    renderPage()
    expect(await screen.findAllByText('Aucun OT sur cette page')).toHaveLength(7)
    expect(screen.queryByRole('button', { name: /précédent/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /suivant/i })).not.toBeInTheDocument()
  })
})
