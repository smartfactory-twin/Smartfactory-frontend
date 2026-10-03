import { Wrench, Bell, ClipboardList, Activity } from 'lucide-react'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import KpiCard from '../../components/common/KpiCard'
import EmptyState from '../../components/common/EmptyState'
import { MachineStatusBadge, AlertSeverityBadge } from '../../components/common/StatusBadge'
import { useAuthContext } from '../../context/AuthContext'
import { useApiData } from '../../hooks/useApiData'
import { getMachines } from '../../services/machineService'
import { getAlerts } from '../../services/alertService'
import { getMeasurements } from '../../services/sensorService'
import { getNotifications } from '../../services/notificationService'

// Statuts qui nécessitent attention
const ATTENTION_STATUSES = ['DEGRADE', 'CRITIQUE', 'HORS_LIGNE']

export default function TechnicianDashboardPage() {
  const { user } = useAuthContext()
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const { data: machinesData, loading: loadingMachines } = useApiData(() => getMachines(), [])
  const { data: alertsData,   loading: loadingAlerts }   = useApiData(() => getAlerts({ limit: 5 }), [])
  const { data: measData,     loading: loadingMeas }     = useApiData(() => getMeasurements({ limit: 5 }), [])
  const { data: notifData,    loading: loadingNotif }    = useApiData(() => getNotifications({ limit: 5 }), [])

  const machines     = machinesData?.results ?? machinesData ?? []
  const alerts       = alertsData?.results   ?? alertsData   ?? []
  const measurements = measData?.results     ?? measData     ?? []
  const notifications= notifData?.results    ?? notifData    ?? []

  const attentionMachines = machines.filter(m => ATTENTION_STATUSES.includes(m.statut))

  return (
    <TechnicianLayout pageTitle="Dashboard">
      {/* En-tête */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 mb-1">
          {dateStr.toUpperCase()}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.prenom} 👋</h1>
        <p className="mt-1 text-sm text-gray-500">Voici l'état des équipements sous votre surveillance.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={Wrench} label="Mes machines"
          value={loadingMachines ? null : machines.length || '—'}
          sub="assignées" iconBg="bg-blue-50 text-blue-600"
          loading={loadingMachines}
        />
        <KpiCard
          icon={Bell} label="Alertes actives"
          value={loadingAlerts ? null : alerts.length || '—'}
          sub="à traiter" iconBg="bg-red-50 text-red-500"
          loading={loadingAlerts}
        />
        <KpiCard
          icon={ClipboardList} label="Interventions"
          value="—" sub="En attente backend"
          iconBg="bg-orange-50 text-orange-500"
        />
        <KpiCard
          icon={Activity} label="Machines à risque"
          value={loadingMachines ? null : attentionMachines.length || '—'}
          sub="dégradé / critique / hors ligne"
          iconBg="bg-yellow-50 text-yellow-500"
          loading={loadingMachines}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
        {/* Machines nécessitant attention */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900 text-sm">Machines nécessitant attention</h2>
            <p className="text-xs text-gray-400 mt-0.5">Statut dégradé, critique ou hors ligne</p>
          </div>
          <div className="divide-y divide-gray-50">
            {loadingMachines ? (
              <div className="p-5 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}
              </div>
            ) : attentionMachines.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="Aucune machine à risque"
                description="Toutes les machines sont en état normal, ou les données ne sont pas encore disponibles."
              />
            ) : (
              attentionMachines.map(m => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.nom}</p>
                    <p className="text-xs text-gray-400">{m.identifiant_interne} · {m.localisation}</p>
                  </div>
                  <MachineStatusBadge status={m.statut} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dernières alertes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900 text-sm">Dernières alertes</h2>
            <p className="text-xs text-gray-400 mt-0.5">Triées par niveau de criticité</p>
          </div>
          <div className="divide-y divide-gray-50">
            {loadingAlerts ? (
              <div className="p-5 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}
              </div>
            ) : alerts.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Aucune alerte"
                description="Aucune alerte active. Les données seront disponibles après le déploiement du module alertes."
              />
            ) : (
              alerts.map(a => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.titre ?? a.message}</p>
                    <p className="text-xs text-gray-400">{a.machine_nom} · {new Date(a.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <AlertSeverityBadge severity={a.niveau} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Dernières mesures */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900 text-sm">Dernières mesures capteurs</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {loadingMeas ? (
              <div className="p-5 space-y-3">
                {[1,2].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}
              </div>
            ) : measurements.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Aucune mesure disponible"
                description="Les mesures capteurs seront affichées ici après le déploiement du module capteurs."
              />
            ) : (
              measurements.map(m => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.capteur_type} — {m.machine_nom}</p>
                    <p className="text-xs text-gray-400">{new Date(m.timestamp).toLocaleString('fr-FR')}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{m.valeur} {m.unite}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900 text-sm">Notifications récentes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {loadingNotif ? (
              <div className="p-5 space-y-3">
                {[1,2].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Aucune notification"
                description="Vos notifications apparaîtront ici."
              />
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`flex items-start gap-3 px-5 py-3 ${!n.lu ? 'bg-blue-50/40' : ''}`}>
                  <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${!n.lu ? 'bg-primary-500' : 'bg-gray-200'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{n.titre}</p>
                    <p className="text-xs text-gray-500">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </TechnicianLayout>
  )
}
