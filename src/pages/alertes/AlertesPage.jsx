import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, ClipboardList, Search, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import { getAlert, getAlerts, acknowledgeAlert, prepareOtFromAlert } from '../../services/alertService'
import { getMachines } from '../../services/machineService'
import { getNotifications, getNotificationCount, markAllAsRead, markAsRead } from '../../services/notificationService'

const LEVELS = ['MINEURE', 'MAJEURE', 'CRITIQUE']
const STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']

const badgeClasses = {
  MINEURE: 'bg-yellow-100 text-yellow-800',
  MAJEURE: 'bg-orange-100 text-orange-800',
  CRITIQUE: 'bg-red-100 text-red-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  ACKNOWLEDGED: 'bg-violet-100 text-violet-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
}

function formatDate(dateValue) {
  if (!dateValue) return '—'
  const date = new Date(dateValue)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatThreshold(alert) {
  if (!alert) return '—'
  const seuil = alert.seuil ?? ''
  const unite = alert.unite ? ` ${alert.unite}` : ''
  return `${seuil}${unite}`
}

export default function AlertesPage({ mode = 'alerts' }) {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedAlertId = searchParams.get('alerte')
  const role = user?.role ?? 'OPERATEUR'

  const Layout = role === 'ADMIN'
    ? AdminLayout
    : role === 'TECHNICIEN'
      ? TechnicianLayout
      : OperatorLayout

  const [alerts, setAlerts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [ackOpen, setAckOpen] = useState(false)
  const [commentaire, setCommentaire] = useState('')
  const [ackLoading, setAckLoading] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMachine, setFilterMachine] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [error, setError] = useState('')

  const loadMachineOptions = async () => {
    try {
      const data = await getMachines({ page_size: 200 })
      const results = data.results ?? data ?? []
      setMachines(results)
    } catch {
      setMachines([])
    }
  }

  const loadNotifications = async () => {
    setNotificationsLoading(true)
    try {
      const [data, counter] = await Promise.all([
        getNotifications({ ordering: '-date_creation', page_size: 10 }),
        getNotificationCount(),
      ])
      setNotifications(data.results ?? data ?? [])
      setUnreadCount(counter?.non_lues ?? 0)
    } catch {
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setNotificationsLoading(false)
    }
  }

  const loadAlerts = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {
        ordering: '-date_declenchement',
      }
      if (search) params.search = search
      if (filterLevel) params.niveau = filterLevel
      if (filterStatus) params.statut = filterStatus
      if (filterMachine) params.machine = filterMachine
      if (filterPeriod) {
        const days = Number(filterPeriod)
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        params['date_declenchement__gte'] = since
      }
      const data = await getAlerts(params)
      setAlerts(data.results ?? data ?? [])
    } catch {
      setError('Impossible de charger les alertes.')
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMachineOptions()
    loadNotifications()
  }, [])

  useEffect(() => {
    loadAlerts()
  }, [search, filterLevel, filterStatus, filterMachine, filterPeriod])

  const openAlertDetail = async (alertId) => {
    setDetailOpen(true)
    try {
      const data = await getAlert(alertId)
      setSelectedAlert(data)
    } catch {
      setSubmitMessage('Impossible d’ouvrir le détail de cette alerte.')
    }
  }

  useEffect(() => {
    if (requestedAlertId) openAlertDetail(requestedAlertId)
  }, [requestedAlertId])

  const handleNotificationClick = async (notification) => {
    if (!notification?.alerte) return
    try {
      await markAsRead(notification.id)
      await loadNotifications()
      await openAlertDetail(notification.alerte)
    } catch {
      setSubmitMessage('Impossible d’ouvrir la notification.')
    }
  }

  const handleAcknowledge = async () => {
    if (!selectedAlert) return
    const trimmed = commentaire.trim()
    if (!trimmed) {
      setSubmitMessage('Le commentaire est obligatoire pour acquitter une alerte.')
      return
    }

    setAckLoading(true)
    try {
      await acknowledgeAlert(selectedAlert.id, trimmed)
      setAckOpen(false)
      setCommentaire('')
      setSubmitMessage('Alerte acquittée avec succès.')
      await loadAlerts()
      await loadNotifications()
      const refreshed = await getAlert(selectedAlert.id)
      setSelectedAlert(refreshed)
    } catch (err) {
      if (err?.response?.status === 409) {
        try {
          const refreshed = await getAlert(selectedAlert.id)
          setSelectedAlert(refreshed)
        } catch (refreshError) {
          console.error('Impossible de rafraîchir l’état de l’alerte après le conflit.', refreshError)
        }
        await loadAlerts()
        setSubmitMessage('Cette alerte a déjà été traitée. Son état a été actualisé.')
        return
      }
      const message = err?.response?.data?.commentaire?.[0] || 'Impossible d’acquitter cette alerte.'
      setSubmitMessage(message)
    } finally {
      setAckLoading(false)
    }
  }

  const handlePrepareOt = async () => {
    if (!selectedAlert) return
    try {
      const payload = await prepareOtFromAlert(selectedAlert.id)
      localStorage.setItem('smartfactory_ot_prep', JSON.stringify(payload))
      setSubmitMessage(`Préparation d’OT enregistrée pour ${payload.machine_nom ?? 'la machine'}.`)
    } catch {
      setSubmitMessage('Préparation de l’OT impossible pour le moment.')
    }
  }

  const clearMessage = () => setSubmitMessage('')

  return (
    <Layout pageTitle={mode === 'notifications' ? 'Notifications' : 'Alertes'}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'notifications' ? 'Notifications' : 'Alertes'}
            </h1>
            <p className="text-sm text-gray-500">
              {mode === 'notifications'
                ? 'Suivi des notifications in-app.'
                : 'Vue d’ensemble des événements hors seuil.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/alertes')}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
            >
              Alertes
            </button>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
            >
              <Bell className="h-4 w-4" />
              Notifications
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {submitMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center justify-between gap-3">
            <span>{submitMessage}</span>
            <button type="button" onClick={clearMessage} className="text-emerald-900 font-semibold">Fermer</button>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.9fr)]">
          <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex flex-col gap-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  aria-label="Recherche alertes"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Recherche par machine, capteur, référence…"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
                  <option value="">Niveau</option>
                  {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>

                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
                  <option value="">Statut</option>
                  {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>

                <select value={filterMachine} onChange={(e) => setFilterMachine(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
                  <option value="">Machine</option>
                  {machines.map((machine) => (
                    <option key={machine.id} value={machine.id}>{machine.nom}</option>
                  ))}
                </select>

                <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
                  <option value="">Période</option>
                  <option value="7">7 jours</option>
                  <option value="30">30 jours</option>
                  <option value="90">90 jours</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                Aucune alerte pour cette sélection.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-gray-200 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Niveau</th>
                      <th className="px-3 py-2 font-medium">Statut</th>
                      <th className="px-3 py-2 font-medium">Machine</th>
                      <th className="px-3 py-2 font-medium">Capteur</th>
                      <th className="px-3 py-2 font-medium">Valeur</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr key={alert.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${badgeClasses[alert.niveau] || 'bg-slate-100 text-slate-700'}`}>
                            {alert.niveau_label || alert.niveau}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${badgeClasses[alert.statut] || 'bg-slate-100 text-slate-700'}`}>
                            {alert.statut_label || alert.statut}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-800">{alert.machine_nom || alert.machine}</td>
                        <td className="px-3 py-3 text-gray-700">{alert.capteur_identifiant || alert.capteur}</td>
                        <td className="px-3 py-3 text-gray-700">{alert.valeur} {alert.unite}</td>
                        <td className="px-3 py-3 text-gray-700">{formatDate(alert.date_declenchement)}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => openAlertDetail(alert.id)}
                            className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                          >
                            Détail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary-600" />
                <h2 className="text-base font-bold text-gray-900">Notifications</h2>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={async () => { await markAllAsRead(); await loadNotifications(); }}
                  className="text-xs font-medium text-primary-700 hover:text-primary-900"
                >
                  Tout lire
                </button>
              )}
            </div>

            {notificationsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 text-center">
                Aucune notification.
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full rounded-lg border p-3 text-left transition ${notification.lue ? 'border-gray-200 bg-gray-50' : 'border-primary-200 bg-primary-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{notification.titre}</p>
                        <p className="mt-1 text-xs text-gray-600">{notification.machine_nom || 'Machine'}</p>
                      </div>
                      {!notification.lue && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-500" />}
                    </div>
                    <p className="mt-2 text-xs text-gray-700 line-clamp-3">{notification.message}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                      <span>{notification.niveau_label || notification.niveau}</span>
                      <span>{formatDate(notification.date_creation)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>

      {detailOpen && selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Alerte #{selectedAlert.reference || selectedAlert.id}</p>
                <h3 className="mt-1 text-xl font-bold text-gray-900">{selectedAlert.niveau_label || selectedAlert.niveau}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailOpen(false)
                  if (requestedAlertId) setSearchParams({}, { replace: true })
                }}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><p className="text-xs uppercase tracking-wide text-gray-500">Machine</p><p className="mt-1 font-semibold text-gray-900">{selectedAlert.machine_nom || selectedAlert.machine}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-gray-500">Capteur</p><p className="mt-1 font-semibold text-gray-900">{selectedAlert.capteur_identifiant || selectedAlert.capteur}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-gray-500">Valeur</p><p className="mt-1 font-semibold text-gray-900">{selectedAlert.valeur} {selectedAlert.unite || ''}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-gray-500">Seuil</p><p className="mt-1 font-semibold text-gray-900">{formatThreshold(selectedAlert)}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-gray-500">Statut</p><span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${badgeClasses[selectedAlert.statut] || 'bg-slate-100 text-slate-700'}`}>{selectedAlert.statut_label || selectedAlert.statut}</span></div>
                <div><p className="text-xs uppercase tracking-wide text-gray-500">Déclenchée</p><p className="mt-1 font-semibold text-gray-900">{formatDate(selectedAlert.date_declenchement)}</p></div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Message</p>
                <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{selectedAlert.message}</p>
              </div>

              {selectedAlert.commentaire_acquittement && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Commentaire d’acquittement</p>
                  <p className="mt-2 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">{selectedAlert.commentaire_acquittement}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                {(selectedAlert.acquittable ?? selectedAlert.statut === 'ACTIVE') && (
                  <button
                    type="button"
                    onClick={() => {
                      setAckOpen(true)
                      setCommentaire('')
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Acquitter
                  </button>
                )}

                {role !== 'OPERATEUR' && (
                  <button
                    type="button"
                    onClick={handlePrepareOt}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Créer un ordre de travail
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {ackOpen && selectedAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Acquitter l’alerte</h3>
              <button type="button" onClick={() => setAckOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Commentaire obligatoire</label>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                placeholder="Ex. Inspection visuelle effectuée. Ventilation à vérifier."
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setAckOpen(false)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={ackLoading || !commentaire.trim()}
                className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ackLoading ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
