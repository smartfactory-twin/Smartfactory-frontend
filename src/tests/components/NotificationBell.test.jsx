import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NotificationBell from '../../components/layout/NotificationBell'
import * as notificationService from '../../services/notificationService'

vi.mock('../../services/notificationService', () => ({
  getNotificationCount: vi.fn(),
}))

describe('NotificationBell', () => {
  it('shows the unread indicator and opens the role-specific notification page', async () => {
    notificationService.getNotificationCount.mockResolvedValue({ non_lues: 2 })

    render(
      <MemoryRouter initialEntries={['/']}>
        <NotificationBell role="TECHNICIEN" />
        <Routes>
          <Route path="/technician/notifications" element={<p>Notifications page</p>} />
        </Routes>
      </MemoryRouter>
    )

    const bell = await screen.findByRole('link', { name: /2 non lues/i })
    expect(bell.querySelector('[aria-hidden="true"]')).toBeInTheDocument()

    await userEvent.click(bell)
    expect(await screen.findByText('Notifications page')).toBeInTheDocument()
  })
})
