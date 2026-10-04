import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { getNotificationCount } from '../../services/notificationService'

const notificationRoutes = {
  ADMIN: '/notifications',
  TECHNICIEN: '/technician/notifications',
  OPERATEUR: '/operator/notifications',
}

export default function NotificationBell({ role }) {
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    const refreshCount = async () => {
      try {
        const counter = await getNotificationCount()
        if (active) {
          setUnreadCount(counter?.non_lues ?? 0)
          setLoadError(false)
        }
      } catch (error) {
        if (active) {
          setLoadError(true)
          console.error('Impossible de récupérer le compteur de notifications.', error)
        }
      }
    }

    refreshCount()
    const intervalId = window.setInterval(refreshCount, 30_000)
    window.addEventListener('focus', refreshCount)
    window.addEventListener('notifications-updated', refreshCount)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshCount)
      window.removeEventListener('notifications-updated', refreshCount)
    }
  }, [location.pathname])

  return (
    <Link
      to={notificationRoutes[role] ?? notificationRoutes.OPERATEUR}
      aria-label={loadError
        ? 'Notifications, compteur indisponible'
        : `Notifications${unreadCount ? `, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : ''}`}
      className="relative rounded-lg p-2 transition-colors hover:bg-gray-100"
    >
      <Bell className="h-5 w-5 text-gray-500" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-600"
        />
      )}
    </Link>
  )
}
