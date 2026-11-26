import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, AlertTriangle, Bell, Building2, ChevronRight, Cpu, RotateCw, Wrench,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import Alert from '../../components/common/Alert'
import { useAuthContext } from '../../context/AuthContext'
import { getUsines, getMachineStatusCounts } from '../../services/machineService'
import { getUsineHierarchie } from '../../services/equipementService'
import { getAlertDashboardStats, getAlerts } from '../../services/alertService'
import { listUsers } from '../../services/authService'

const MACHINE_STATUSES = [
  { key: 'NORMAL', label: 'Normal', color: 'var(--sf-ok)' },
  { key: 'DEGRADE', label: 'Dégradé', color: 'var(--sf-warn)' },
  { key: 'CRITIQUE', label: 'Critique', color: 'var(--sf-crit)' },
  { key: 'HORS_LIGNE', label: 'Hors ligne', color: 'var(--sf-off)' },
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
  machinesInAlert: 0,
  alertsByLevel: {},
  activeUsers: 0,
  alertsByDay: [],
  plants: [],
  latestAlerts: [],
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
      dateKey: [start.getFullYear(), String(start.getMonth() + 1).padStart(2, '0'), String(start.getDate()).padStart(2, '0')].join('-'),
      params: {
        'date_declenchement__gte': start.toISOString(),
        'date_declenchement__lte': new Date(end.getTime() - 1).toISOString(),
      },
    }
  })
}

function StatCard({ label, value, detail, icon: Icon, color, loading }) {
  return (
    <div className="sf-dashboard-kpi rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <p className="sf-dashboard-kpi-label text-sm text-gray-500">{label}</p>
        <div className={`sf-dashboard-kpi-icon rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></div>
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

const MACHINE_STATUS_LABELS = {
  NORMAL: 'Normal', DEGRADE: 'Dégradé', CRITIQUE: 'Critique', HORS_LIGNE: 'Hors ligne',
}

function FactoryPlan({ plants, loading }) {
  if (loading) return <div className="sf-dashboard-empty sf-factory-empty">Chargement de la structure…</div>
  if (!plants.length) return <div className="sf-dashboard-empty sf-factory-empty"><Building2 aria-hidden="true" /><span>Aucune usine configurée</span><Link to="/equipements">Configurer la structure <ChevronRight aria-hidden="true" /></Link></div>
  const zoneCount = plants.reduce((sum, plant) => sum + (plant.zones?.length ?? 0), 0)
  const machineCount = plants.reduce((total, plant) => total + (plant.zones ?? []).reduce((zoneTotal, zone) => zoneTotal + (zone.lignes ?? []).reduce((lineTotal, line) => lineTotal + (line.machines?.length ?? 0), 0), 0), 0)
  const example = plants[0]
  const exampleZones = example.zones ?? []
  return <div className="sf-factory-overview">
    <div className="sf-factory-metrics"><span><b>{plants.length}</b><small>Usines</small></span><span><b>{zoneCount}</b><small>Zones</small></span><span><b>{machineCount}</b><small>Machines</small></span></div>
    <section className="sf-factory-example"><header><Building2 aria-hidden="true" /><div><small>Exemple d’usine</small><b>{example.nom}</b></div><span>{exampleZones.length} zone{exampleZones.length === 1 ? '' : 's'}</span></header>
      {exampleZones.length ? <div className="sf-factory-example-zones">{exampleZones.slice(0, 2).map((zone) => <span key={zone.id}>{zone.nom}<small>{zone.lignes?.length ?? 0} ligne{zone.lignes?.length === 1 ? '' : 's'}</small></span>)}{exampleZones.length > 2 && <small>+{exampleZones.length - 2} autres zones</small>}</div> : <p className="sf-dashboard-empty sf-factory-empty">Aucune zone dans cet exemple.</p>}
    </section>
    <Link to="/equipements" className="sf-structure-link">Explorer toute la structure <ChevronRight aria-hidden="true" /></Link>
  </div>
}

function LatestActiveAlerts({ count, levels, loading }) {
  if (loading) return <div className="sf-dashboard-empty">Chargement des alertes…</div>
  if (!count) return <div className="sf-alert-summary is-clear"><span className="sf-alert-summary-mark"><Bell aria-hidden="true" /></span><span><b>Aucune alerte active</b><small>Tout est calme sur votre périmètre.</small></span></div>
  const dominant = Object.entries(levels || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
  const levelLabels = { CRITIQUE: 'Critique', MAJEURE: 'Majeure', MINEURE: 'Mineure', INFORMATION: 'Information' }
  return <Link to="/alertes" className={`sf-alert-summary is-${String(dominant?.[0] || 'active').toLowerCase()}`}>
    <span className="sf-alert-summary-mark"><Bell aria-hidden="true" /></span>
    <span className="sf-alert-summary-copy"><small>Alertes non acquittées</small><b>{count} alerte{count === 1 ? '' : 's'}</b></span>
    {dominant && <span className="sf-alert-dominant"><i />{levelLabels[dominant[0]] || dominant[0]} · {dominant[1]}</span>}
    <ChevronRight aria-hidden="true" />
  </Link>
}

function ChartPanel({ title, description, children }) {
  return (
    <section className="sf-dashboard-panel rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="sf-dashboard-panel-heading mb-5">
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
        className="sf-status-bar mb-6 flex h-3 overflow-hidden rounded-full bg-gray-100"
        role="img"
        aria-label={`Répartition des ${total} équipements par statut`}
      >
        {MACHINE_STATUSES.map(({ key, label, color }) => (
          <div
            key={key}
            style={{ width: total ? `${(statuses[key] / total) * 100}%` : '0%' }}
            className={`sf-status-bar-segment is-${key.toLowerCase()}`}
            data-status={key}
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
          <circle cx="50" cy="50" r="43" fill="none" stroke="var(--sf-line)" strokeWidth="12" />
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
              <line x1="36" x2="670" y1={y} y2={y} stroke="var(--sf-line)" strokeDasharray="4 5" />
              <text x="28" y={y + 4} textAnchor="end" fill="var(--sf-muted)" fontSize="11">
                {Math.round(maxValue * fraction)}
              </text>
            </g>
          )
        })}
        {positions.map(({ label, total, x, y, height, barWidth: width }) => (
          <g key={label}>
            <rect x={x} y={y} width={width} height={height} rx="6" fill="var(--sf-accent)" />
            <text x={x + width / 2} y={Math.max(18, y - 8)} textAnchor="middle" fill="var(--sf-ink-soft)" fontSize="12" fontWeight="600">
              {total}
            </text>
            <text x={x + width / 2} y="185" textAnchor="middle" fill="var(--sf-muted)" fontSize="12">
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
      const [usinesResponse, users, alertStats, latestAlertsResponse, machineStatusResponse] = await Promise.all([
        getUsines(),
        listUsers({ actif: 'true' }),
        getAlertDashboardStats({
          'date_declenchement__gte': days[0].params.date_declenchement__gte,
          'date_declenchement__lte': days[days.length - 1].params.date_declenchement__lte,
        }),
        getAlerts({ statut: 'ACTIVE', ordering: '-date_declenchement', page_size: 5 }),
        getMachineStatusCounts(),
      ])
      const machineStatuses = machineStatusResponse?.par_statut ?? {}
      const machines = Object.values(machineStatuses).reduce((sum, count) => sum + count, 0)
      const usines = usinesResponse?.results ?? usinesResponse ?? []
      const plants = await Promise.all(usines.map((usine) => getUsineHierarchie(usine.id)))
      const latestAlerts = latestAlertsResponse?.results ?? latestAlertsResponse ?? []

      setStats({
        sites: resultCount(usinesResponse),
        machines,
        machineStatuses,
        activeAlerts: alertStats.actives ?? 0,
        criticalAlerts: alertStats.critiques ?? 0,
        machinesInAlert: alertStats.machines_en_alerte ?? 0,
        alertsByLevel: alertStats.par_niveau ?? {},
        activeUsers: resultCount(users) + (user?.actif === false ? 0 : 1),
        plants,
        latestAlerts,
        alertsByDay: days.map(({ label, dateKey }) => ({
          label,
          total: alertStats?.par_jour?.find((day) => day.date === dateKey)?.total ?? 0,
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

  return (
    <AdminLayout>
      <div className="sf-dashboard-page">
      <div className="sf-dashboard-header mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="sf-dashboard-overline">Supervision de l’usine · {dateStr}</p>
          <h1 className="text-3xl font-bold text-gray-900">Bonjour, {user?.prenom}</h1>
          <p className="mt-1 text-gray-500">Vue opérationnelle de vos sites industriels.</p>
          <div className="sf-dashboard-context">{loading ? '—' : stats.sites} site{stats.sites === 1 ? '' : 's'} industriel{stats.sites === 1 ? '' : 's'} <span>·</span> {loading ? '—' : stats.activeUsers} compte{stats.activeUsers === 1 ? '' : 's'} actif{stats.activeUsers === 1 ? '' : 's'}</div>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="sf-dashboard-refresh inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
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

      <div className="sf-dashboard-kpi-grid mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Machines suivies"
          value={loading ? '—' : stats.machines}
          detail={`${stats.machineStatuses.NORMAL ?? 0} en fonctionnement normal`}
          icon={Cpu}
          color="sf-kpi-blue"
          loading={loading}
        />
        <StatCard
          label="Machines en alerte"
          value={loading ? '—' : stats.machinesInAlert}
          detail={`${stats.criticalAlerts} alerte${stats.criticalAlerts === 1 ? '' : 's'} critique${stats.criticalAlerts === 1 ? '' : 's'} active${stats.criticalAlerts === 1 ? '' : 's'}`}
          icon={AlertTriangle}
          color="sf-kpi-warning"
          loading={loading}
        />
        <StatCard
          label="Alertes actives"
          value={loading ? '—' : stats.activeAlerts}
          detail={`${stats.criticalAlerts} critique${stats.criticalAlerts === 1 ? '' : 's'}`}
          icon={Bell}
          color="sf-kpi-critical"
          loading={loading}
        />
        <StatCard
          label="Interventions en cours"
          value="—"
          detail="Suivi disponible avec le module CMMS"
          icon={Wrench}
          color="sf-kpi-purple"
          loading={loading}
        />
      </div>

      <div className="sf-dashboard-primary-grid mb-6">
        <ChartPanel title="Plan de l’usine" description="État des équipements par site, zone et ligne de production">
          <div className="sf-dashboard-legend" aria-label="Légende des statuts">
            {MACHINE_STATUSES.map(({ key, label }) => <span className={`is-${key.toLowerCase()}`} key={key}><i />{label}</span>)}
          </div>
          <FactoryPlan plants={stats.plants} loading={loading} />
        </ChartPanel>
        <ChartPanel title="Alertes" description="Synthèse des alertes à traiter">
          <LatestActiveAlerts count={stats.activeAlerts} levels={stats.alertsByLevel} loading={loading} />
          <Link to="/alertes" className="sf-dashboard-view-all">Voir toutes les alertes <ChevronRight aria-hidden="true" /></Link>
        </ChartPanel>
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
      </div>
    </AdminLayout>
  )
}
