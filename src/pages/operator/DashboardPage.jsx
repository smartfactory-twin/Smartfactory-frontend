import { Wrench, Bell, Activity, WifiOff } from 'lucide-react'
import OperatorLayout from '../../components/layout/OperatorLayout'
import KpiCard from '../../components/common/KpiCard'
import EmptyState from '../../components/common/EmptyState'
import { MachineStatusBadge, AlertSeverityBadge } from '../../components/common/StatusBadge'
import { useAuthContext } from '../../context/AuthContext'
import { useApiData } from '../../hooks/useApiData'
import { getMachines } from '../../services/machineService'
import { getAlerts } from '../../services/alertService'
import { getMeasurements } from '../../services/sensorService'
import { getNotifications } from '../../services/notificationService'

export default function OperatorDashboardPage() {
  const { user } = useAuthContext()
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const { data: machinesData, loading: loadingMachines } = useApiData(() => getMachines(), [])
  const { data: alertsData,   loading: loadingAlerts }   = useApiData(() => getAlerts({ limit: 5 }), [])
  const { data: measData,     loading: loadingMeas }     = useApiData(() => getMeasurements({ limit: 5 }), [])
  const { data: notifData,    loading: loadingNotif }    = useApiData(() => getNotifications({ limit: 5 }), [])

  const machines      = machinesData?.results ?? machinesData ?? []
  const alerts        = alertsData?.results   ?? alertsData   ?? []
  const measurements  = measData?.results     ?? measData     ?? []
  const notifications = notifData?.results    ?? notifData    ?? []

  // Comptages par statut (spécification : NORMAL / DEGRADE / CRITIQUE / HORS_LIGNE)
  const count = (status) => machines.filter(m => m.statut === status).length

  return (
    <OperatorLayout pageTitle="Dashboard">
      {/* En-tête */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 mb-1">
          {dateStr.toUpperCase()}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.prenom} 👋</h1>
        <p className="mt-1 text-sm text-gray-500">Surveillance de l'état des équipements en production.</p>
      </div>

      {/* KPIs statut machines — 4 statuts définis par la spec */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={Wrench} label="Machines normales"
          value={loadingMachines ? null : count('NORMAL') || '—'}
          iconBg="bg-green-50 text-green-600" loading={loadingMachines}
        />
        <KpiCard
          icon={Activity} label="Machines dégradées"
          value={loadingMachines ? null : count('DEGRADE') || '—'}
          iconBg="bg-orange-50 text-orange-500" loading={loadingMachines}
        />
        <KpiCard
          icon={Bell} label="Machines critiques"
          value={loadingMachines ? null : count('CRITIQUE') || '—'}
          iconBg="bg-red-50 text-red-500" loading={loadingMachines}
        />
        <KpiCard
          icon={WifiOff} label="Machines hors ligne"
          value={loadingMachines ? null : count('HORS_LIGNE') || '—'}
          iconBg="bg-gray-100 text-gray-500" loading={loadingMachines}
        />
      </div>

      {/* Mes machines */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-5">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Mes machines</h2>
            <p className="text-xs text-gray-400 mt-0.5">État actuel des équipements accessibles</p>
          </div>
          <span className="text-xs text-gray-400">{machines.length} machine{machines.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="divide-y divide-gray-50">
          {loadingMachines ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />)}
            </div>
          ) : machines.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Aucune machine assignée"
              description="Vos machines apparaîtront ici après le déploiement du module machines (Sprint 2)."
            />
          ) : (
            machines.map(m => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{m.nom}</p>
                  <p className="text-xs text-gray-400">{m.identifiant_interne} · {m.localisation}</p>
                  {m.derniere_mesure && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Dernière mesure : {new Date(m.derniere_mesure).toLocaleString('fr-FR')}
                    </p>
                  )}
                </div>
                <MachineStatusBadge status={m.statut} />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
        {/* Mesures capteurs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900 text-sm">Mesures des machines</h2>
            <p className="text-xs text-gray-400 mt-0.5">Dernières valeurs des capteurs</p>
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
                description="Les mesures apparaîtront ici après le déploiement du module capteurs."
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

        {/* Alertes récentes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900 text-sm">Alertes récentes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {loadingAlerts ? (
              <div className="p-5 space-y-3">
                {[1,2].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}
              </div>
            ) : alerts.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Aucune alerte"
                description="Aucune alerte concernant vos machines."
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
    </OperatorLayout>
  )
}
