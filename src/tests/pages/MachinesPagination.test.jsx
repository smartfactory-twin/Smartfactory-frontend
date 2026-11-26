import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MachinesListPage from '../../pages/machines/MachinesListPage'
import { AuthContext } from '../../context/AuthContext'
import * as machineService from '../../services/machineService'

vi.mock('../../services/machineService', () => ({ getMachines: vi.fn(), getZones: vi.fn(), deleteMachine: vi.fn() }))
vi.mock('../../components/layout/AdminLayout', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../components/layout/TechnicianLayout', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../components/layout/OperatorLayout', () => ({ default: ({ children }) => <main>{children}</main> }))

function renderPage() {
  return render(<AuthContext.Provider value={{ user: { role: 'ADMIN' } }}><MemoryRouter><MachinesListPage /></MemoryRouter></AuthContext.Provider>)
}

describe('pagination des machines', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    machineService.getZones.mockResolvedValue({ results: [] })
    machineService.getMachines.mockImplementation(({ page = 1 } = {}) => Promise.resolve({
      count: 21,
      results: [{ id: page, nom: `Machine page ${page}`, identifiant_interne: `M-${page}`, statut: 'NORMAL' }],
    }))
  })
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })

  it('charge la page suivante, revient à la précédente et désactive les limites', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    expect(await screen.findByText('Machine page 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /précédent/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => expect(machineService.getMachines).toHaveBeenLastCalledWith({ page: 2 }))
    expect(await screen.findByText('Machine page 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /précédent/i }))
    expect(await screen.findByText('Machine page 1')).toBeInTheDocument()
  })

  it('remet la pagination à la première page après un changement de filtre', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await screen.findByText('Machine page 1')
    await user.click(screen.getByRole('button', { name: /suivant/i }))
    await screen.findByText('Machine page 2')
    const status = screen.getAllByRole('combobox')[0]
    await user.selectOptions(status, 'NORMAL')
    await waitFor(() => expect(machineService.getMachines).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, statut: 'NORMAL' })))
  })
})
