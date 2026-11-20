import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { getNotificationCount } from '../../services/notificationService'

const notificationRoutes = {
  ADMIN: '/alertes',
  TECHNICIEN: '/technician/alerts',
  OPERATEUR: '/operator/alerts',
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
      className="sf-top-notification-link"
    >
      <Bell aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="sf-top-count" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </Link>
  )
}
