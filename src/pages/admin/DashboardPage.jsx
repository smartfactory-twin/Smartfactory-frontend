import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Building2, Cpu, RotateCw, Users,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import Alert from '../../components/common/Alert'
import { useAuthContext } from '../../context/AuthContext'
import { getUsines, getMachines } from '../../services/machineService'
import { getAlertStats } from '../../services/alertService'
import { listUsers } from '../../services/authService'

const MACHINE_STATUSES = [
  { key: 'NORMAL', label: 'Opérationnelles', color: '#10b981', barClass: 'bg-emerald-500' },
  { key: 'DEGRADE', label: 'Dégradées', color: '#f59e0b', barClass: 'bg-amber-500' },
  { key: 'CRITIQUE', label: 'Critiques', color: '#ef4444', barClass: 'bg-red-500' },
  { key: 'HORS_LIGNE', label: 'Hors ligne', color: '#64748b', barClass: 'bg-slate-500' },
]

const ALERT_LEVELS = [
  { key: 'CRITIQUE', label: 'Critiques', color: '#ef4444' },
  { key: 'MAJEURE', label: 'Majeures', color: '#f97316' },
  { key: 'MINEURE', label: 'Mineures', color: '#eab308' },
  { key: 'INFORMATION', label: 'Information', color: '#3b82f6' },
]

const EMPTY_STATS = {
  sites: 0,
  machines: 0,
  machineStatuses: {},
  activeAlerts: 0,
  criticalAlerts: 0,
  alertsByLevel: {},
  activeUsers: 0,
  alertsByDay: [],
}

function resultCount(data) {
  if (Number.isFinite(data?.count)) return data.count
  if (Array.isArray(data?.results)) return data.results.length
  return Array.isArray(data) ? data.length : 0
}

function lastSevenDays() {
  const today = new Date()
  return Array.from({ length: 7 }, (_, index) => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    return {
      label: start.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
      params: {
        'date_declenchement__gte': start.toISOString(),
        'date_declenchement__lte': new Date(end.getTime() - 1).toISOString(),
      },
    }
  })
}

function StatCard({ label, value, detail, icon: Icon, color, loading }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <div className={`rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></div>
      </div>
      {loading ? (
        <div className="h-9 w-20 animate-pulse rounded bg-gray-100" />
      ) : (
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      )}
      <p className="mt-1 text-xs text-gray-400">{detail}</p>
    </div>
  )
}

function ChartPanel({ title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  )
}

function MachineStatusChart({ statuses, total }) {
  return (
    <div>
      <div
        className="mb-6 flex h-3 overflow-hidden rounded-full bg-gray-100"
        role="img"
        aria-label={`Répartition des ${total} équipements par statut`}
      >
        {MACHINE_STATUSES.map(({ key, label, barClass }) => (
          <div
            key={key}
            className={barClass}
            style={{ width: total ? `${(statuses[key] / total) * 100}%` : '0%' }}
            title={`${label} : ${statuses[key] ?? 0}`}
          />
        ))}
      </div>
      <ul className="space-y-4">
        {MACHINE_STATUSES.map(({ key, label, color }) => {
          const count = statuses[key] ?? 0
          const percent = total ? Math.round((count / total) * 100) : 0
          return (
            <li key={key} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="flex-1 text-sm text-gray-600">{label}</span>
              <span className="w-10 text-right text-sm font-semibold text-gray-900">{count}</span>
              <span className="w-12 text-right text-xs text-gray-400">{percent}%</span>
            </li>
          )
        })}
      </ul>
      {!total && <p className="mt-5 text-center text-sm text-gray-400">Aucun équipement enregistré.</p>}
    </div>
  )
}

function AlertLevelChart({ levels }) {
  const circumference = 2 * Math.PI * 43
  const total = ALERT_LEVELS.reduce((sum, { key }) => sum + (levels[key] ?? 0), 0)
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Répartition de ${total} alertes par niveau`}>
          <circle cx="50" cy="50" r="43" fill="none" stroke="#f3f4f6" strokeWidth="12" />
          {total > 0 && ALERT_LEVELS.map(({ key, color }) => {
            const value = levels[key] ?? 0
            const segment = (value / total) * circumference
            const circle = (
              <circle
                key={key}
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke={color}
                strokeWidth="12"
                strokeDasharray={`${segment} ${circumference - segment}`}
                strokeDashoffset={-offset}
              />
            )
            offset += segment
            return circle
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{total}</span>
          <span className="text-xs text-gray-400">alertes</span>
        </div>
      </div>
      <ul className="w-full space-y-3 sm:max-w-52">
        {ALERT_LEVELS.map(({ key, label, color }) => (
          <li key={key} className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="flex-1 text-sm text-gray-600">{label}</span>
            <span className="text-sm font-semibold text-gray-900">{levels[key] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AlertsTrendChart({ data }) {
  const maxValue = Math.max(1, ...data.map(({ total }) => total))
  const chartHeight = 148
  const barWidth = 44
  const positions = data.map((item, index) => {
    const x = 54 + index * 91
    const height = item.total ? Math.max(3, (item.total / maxValue) * chartHeight) : 2
    return { ...item, x, y: chartHeight + 12 - height, height, barWidth }
  })

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox="0 0 690 205"
        className="h-52 min-w-[560px] w-full"
        role="img"
        aria-label="Nombre d’alertes déclenchées chaque jour sur les sept derniers jours"
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = 160 - fraction * chartHeight
          return (
            <g key={fraction}>
              <line x1="36" x2="670" y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="4 5" />
              <text x="28" y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="11">
                {Math.round(maxValue * fraction)}
              </text>
            </g>
          )
        })}
        {positions.map(({ label, total, x, y, height, barWidth: width }) => (
          <g key={label}>
            <rect x={x} y={y} width={width} height={height} rx="6" fill="#3b82f6" />
            <text x={x + width / 2} y={Math.max(18, y - 8)} textAnchor="middle" fill="#374151" fontSize="12" fontWeight="600">
              {total}
            </text>
            <text x={x + width / 2} y="185" textAnchor="middle" fill="#6b7280" fontSize="12">
              {label}
            </text>
          </g>
        ))}
      </svg>
      {data.every(({ total }) => total === 0) && (
        <p className="mt-1 text-center text-sm text-gray-400">Aucune alerte sur les sept derniers jours.</p>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthContext()
  const [stats, setStats] = useState(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const days = lastSevenDays()
      const [usines, users, alertStats, ...machineCountsAndDays] = await Promise.all([
        getUsines(),
        listUsers({ actif: 'true' }),
        getAlertStats(),
        ...MACHINE_STATUSES.map(({ key }) => getMachines({ statut: key })),
        ...days.map(({ params }) => getAlertStats(params)),
      ])
      const machineCounts = machineCountsAndDays.slice(0, MACHINE_STATUSES.length)
      const dailyStats = machineCountsAndDays.slice(MACHINE_STATUSES.length)
      const machineStatuses = Object.fromEntries(
        MACHINE_STATUSES.map(({ key }, index) => [key, resultCount(machineCounts[index])])
      )
      const machines = Object.values(machineStatuses).reduce((sum, count) => sum + count, 0)

      setStats({
        sites: resultCount(usines),
        machines,
        machineStatuses,
        activeAlerts: alertStats.actives ?? 0,
        criticalAlerts: alertStats.critiques ?? 0,
        alertsByLevel: alertStats.par_niveau ?? {},
        activeUsers: resultCount(users) + (user?.actif === false ? 0 : 1),
        alertsByDay: days.map(({ label }, index) => ({
          label,
          total: dailyStats[index]?.total ?? 0,
        })),
      })
    } catch {
      setError('Impossible de charger les statistiques du tableau de bord. Réessayez dans quelques instants.')
    } finally {
      setLoading(false)
    }
  }, [user?.actif])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const machineHealth = stats.machines
    ? `${Math.round(((stats.machineStatuses.NORMAL ?? 0) / stats.machines) * 100)}%`
    : '—'

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary-600">
            {dateStr}
          </p>
          <h1 className="text-3xl font-bold text-gray-900">Bonjour, {user?.prenom}</h1>
          <p className="mt-1 text-gray-500">Voici l’état opérationnel de vos sites industriels.</p>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="mb-5">
          <Alert type="error" message={error} />
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sites industriels"
          value={loading ? '—' : stats.sites}
          detail="Usines enregistrées"
          icon={Building2}
          color="bg-blue-50 text-blue-600"
          loading={loading}
        />
        <StatCard
          label="Équipements"
          value={loading ? '—' : stats.machines}
          detail={`Santé opérationnelle : ${machineHealth}`}
          icon={Cpu}
          color="bg-emerald-50 text-emerald-600"
          loading={loading}
        />
        <StatCard
          label="Alertes actives"
          value={loading ? '—' : stats.activeAlerts}
          detail={`${stats.criticalAlerts} critique${stats.criticalAlerts === 1 ? '' : 's'}`}
          icon={AlertTriangle}
          color="bg-red-50 text-red-500"
          loading={loading}
        />
        <StatCard
          label="Utilisateurs actifs"
          value={loading ? '—' : stats.activeUsers}
          detail="Comptes actifs"
          icon={Users}
          color="bg-purple-50 text-purple-600"
          loading={loading}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartPanel title="État des équipements" description="Répartition actuelle par statut">
          {loading ? (
            <div className="h-44 animate-pulse rounded-lg bg-gray-50" />
          ) : (
            <MachineStatusChart statuses={stats.machineStatuses} total={stats.machines} />
          )}
        </ChartPanel>
        <ChartPanel title="Alertes par niveau" description="Répartition sur l’ensemble de l’historique">
          {loading ? (
            <div className="h-44 animate-pulse rounded-lg bg-gray-50" />
          ) : (
            <AlertLevelChart levels={stats.alertsByLevel} />
          )}
        </ChartPanel>
      </div>

      <ChartPanel title="Évolution des alertes" description="Nombre d’alertes déclenchées par jour sur les sept derniers jours">
        {loading ? (
          <div className="h-52 animate-pulse rounded-lg bg-gray-50" />
        ) : (
          <AlertsTrendChart data={stats.alertsByDay} />
        )}
      </ChartPanel>
    </AdminLayout>
  )
}
