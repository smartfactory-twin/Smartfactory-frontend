import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import NotificationsPage from '../../pages/alertes/NotificationsPage'
import { AuthContext } from '../../context/AuthContext'
import * as notificationService from '../../services/notificationService'

vi.mock('../../services/notificationService', () => ({
  getNotifications: vi.fn(),
  getNotificationCount: vi.fn(),
  markAllAsRead: vi.fn(),
  markAsRead: vi.fn(),
}))

function CurrentLocation() {
  const location = useLocation()
  return <p>{`${location.pathname}${location.search}`}</p>
}

describe('NotificationsPage', () => {
  it('shows its own notification list and navigates to the related alert detail', async () => {
    notificationService.getNotifications.mockResolvedValue({
      results: [{
        id: 15,
        titre: 'Alerte — CNC-101',
        message: 'Température supérieure au seuil maximum.',
        niveau: 'MINEURE',
        niveau_label: 'Mineure',
        date_creation: '2026-10-04T10:00:00Z',
        machine_nom: 'CNC-101',
        alerte: 4,
        alerte_reference: 'AL-000004',
        lue: false,
      }],
    })
    notificationService.getNotificationCount.mockResolvedValue({ non_lues: 1 })
    notificationService.markAsRead.mockResolvedValue({ id: 15, lue: true })

    const context = {
      user: { id: 1, email: 'operator@example.com', role: 'OPERATEUR' },
      isAuthenticated: true,
      isLoading: false,
      logout: vi.fn(),
    }

    render(
      <AuthContext.Provider value={context}>
        <MemoryRouter initialEntries={['/operator/notifications']}>
          <Routes>
            <Route path="/operator/notifications" element={<NotificationsPage />} />
            <Route path="/operator/alerts" element={<CurrentLocation />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    const notification = await screen.findByRole('button', { name: /Alerte — CNC-101/i })
    await userEvent.click(notification)

    await waitFor(() => {
      expect(notificationService.markAsRead).toHaveBeenCalledWith(15)
    })
    expect(await screen.findByText('/operator/alerts?alerte=4')).toBeInTheDocument()
  })
})
