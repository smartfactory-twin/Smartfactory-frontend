import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import {
  getNotifications,
  getNotificationCount,
  markAllAsRead,
  markAsRead,
} from '../../services/notificationService'

const notificationRoutes = {
  ADMIN: { notifications: '/notifications', alerts: '/alertes' },
  TECHNICIEN: { notifications: '/technician/notifications', alerts: '/technician/alerts' },
  OPERATEUR: { notifications: '/operator/notifications', alerts: '/operator/alerts' },
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
}

export default function NotificationsPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const role = user?.role ?? 'OPERATEUR'
  const Layout = role === 'ADMIN'
    ? AdminLayout
    : role === 'TECHNICIEN'
      ? TechnicianLayout
      : OperatorLayout
  const routes = notificationRoutes[role] ?? notificationRoutes.OPERATEUR

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  const refreshNotifications = useCallback(async () => {
    try {
      const [data, counter] = await Promise.all([
        getNotifications({ ordering: '-date_creation', page_size: 50 }),
        getNotificationCount(),
      ])
      setNotifications(data.results ?? data ?? [])
      setUnreadCount(counter?.non_lues ?? 0)
      setError('')
    } catch (err) {
      setError('Impossible de charger les notifications. Réessayez dans quelques instants.')
      console.error('Échec de chargement des notifications.', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshNotifications()
    const intervalId = window.setInterval(refreshNotifications, 30_000)
    return () => window.clearInterval(intervalId)
  }, [refreshNotifications])

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.lue) await markAsRead(notification.id)
      await refreshNotifications()
      if (notification.alerte) {
        navigate(`${routes.alerts}?alerte=${encodeURIComponent(notification.alerte)}`)
      }
    } catch (err) {
      setError('Impossible d’ouvrir cette notification. Réessayez.')
      console.error(`Échec d'ouverture de la notification ${notification.id}.`, err)
    }
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await markAllAsRead()
      await refreshNotifications()
    } catch (err) {
      setError('Impossible de marquer les notifications comme lues.')
      console.error('Échec du marquage global des notifications.', err)
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <Layout pageTitle="Notifications">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Bell className="h-6 w-6 text-primary-600" />
              Notifications
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Vos notifications concernant les alertes de votre périmètre.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
              {unreadCount} non lue{unreadCount === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || markingAll}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck className="h-4 w-4" />
              Tout marquer comme lu
            </button>
          </div>
        </div>

        <section aria-label="Liste des notifications" className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {error && (
            <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3 p-5" aria-label="Chargement des notifications">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 font-medium text-gray-700">Aucune notification</p>
              <p className="mt-1 text-sm text-gray-500">Les notifications reçues apparaîtront ici.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex w-full items-start gap-4 p-5 text-left transition hover:bg-gray-50 ${
                      notification.lue ? 'bg-white' : 'bg-red-50/40'
                    }`}
                  >
                    <span className="relative mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <Bell className="h-4 w-4" />
                      {!notification.lue && (
                        <span aria-label="Non lue" className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-600" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900">{notification.titre}</span>
                        <span className="text-xs text-gray-500">{formatDate(notification.date_creation)}</span>
                      </span>
                      <span className="mt-1 block text-sm text-gray-700">{notification.message}</span>
                      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                        {notification.machine_nom && <span>Machine : {notification.machine_nom}</span>}
                        <span>{notification.niveau_label || notification.niveau}</span>
                        {notification.alerte_reference && <span>{notification.alerte_reference}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  )
}
