import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Wrench, RefreshCw, AlertTriangle } from 'lucide-react'
import OperatorLayout from '../../components/layout/OperatorLayout'
import EmptyState from '../../components/common/EmptyState'
import Alert from '../../components/common/Alert'
import Spinner from '../../components/common/Spinner'
import { MachineStatusBadge } from '../../components/common/StatusBadge'
import { getMachines } from '../../services/machineService'
import { getCapteurs, getReadings } from '../../services/sensorService'

// Rafraîchissement périodique (aucune infrastructure WebSocket dans le projet).
const REFRESH_MS = 60000

const SENSOR_TYPE_LABELS = {
  TEMPERATURE: 'Température',
  VIBRATION: 'Vibration',
  PRESSION: 'Pression',
  COURANT: 'Courant',
  VITESSE_RPM: 'Vitesse (RPM)',
  DEBIT: 'Débit',
  NIVEAU_SONORE: 'Niveau sonore',
}

const formatDateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const errorMessage = (err, fallback) =>
  err?.response?.data?.detail || err?.message || fallback

/**
 * Page Surveillance (OPERATEUR) — consultation seule.
 *
 * Données : machines accessibles, capteurs associés et dernière mesure connue.
 * Aucun statut machine n'est modifié : les valeurs hors seuils sont seulement
 * signalées visuellement (le champ `hors_plage` est calculé par le backend).
 */
export default function SurveillancePage() {
  const [machines, setMachines] = useState([])
  const [capteursByMachine, setCapteursByMachine] = useState({})
  const [latestBySensor, setLatestBySensor] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [selectedMachineId, setSelectedMachineId] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const machineData = await getMachines({ limit: 200 })
      const machineList = machineData?.results ?? machineData ?? []
      setMachines(machineList)

      // Capteurs de chaque machine accessible.
      const sensorEntries = await Promise.all(
        machineList.map(async (m) => {
          try {
            const data = await getCapteurs({ machine: m.id, limit: 200 })
            return [m.id, data?.results ?? data ?? []]
          } catch {
            // Une machine dont les capteurs échouent ne casse pas la page.
            return [m.id, []]
          }
        })
      )
      const sensorMap = Object.fromEntries(sensorEntries)
      setCapteursByMachine(sensorMap)

      // Dernière mesure connue par capteur (limit=1 + tri décroissant).
      const allSensors = Object.values(sensorMap).flat()
      const latestEntries = await Promise.all(
        allSensors.map(async (s) => {
          try {
            const data = await getReadings({
              sensor: s.id, ordering: '-timestamp', limit: 1,
            })
            const first = data?.results?.[0] ?? null
            return [s.id, first]
          } catch {
            return [s.id, null]
          }
        })
      )
      setLatestBySensor(Object.fromEntries(latestEntries))

      setError(null)
      setLastUpdate(new Date())
    } catch (err) {
      setError(errorMessage(err, "Impossible de charger les données de surveillance."))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Rafraîchissement périodique des mesures.
  useEffect(() => {
    const id = setInterval(() => load({ silent: true }), REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const sensorsWithLatest = useMemo(() => {
    const rows = []
    machines.forEach((m) => {
      ;(capteursByMachine[m.id] ?? []).forEach((s) => {
        const reading = latestBySensor[s.id] ?? null
        const horsPlage = Boolean(reading?.hors_plage)
        rows.push({
          machine: m,
          capteur: s,
          reading,
          horsPlage,
          anormal: horsPlage && reading != null,
          typeLabel: SENSOR_TYPE_LABELS[s.type_capteur] ?? s.type_capteur,
        })
      })
    })
    return rows
  }, [machines, capteursByMachine, latestBySensor])

  const counts = useMemo(() => {
    const c = { NORMAL: 0, DEGRADE: 0, CRITIQUE: 0, HORS_LIGNE: 0 }
    machines.forEach((m) => { if (c[m.statut] !== undefined) c[m.statut] += 1 })
    return c
  }, [machines])

  const anomalies = useMemo(
    () => sensorsWithLatest.filter((r) => r.anormal),
    [sensorsWithLatest]
  )

  const selectedMachine = useMemo(
    () => machines.find((m) => String(m.id) === String(selectedMachineId)) ?? null,
    [machines, selectedMachineId]
  )

  const selectedRows = useMemo(
    () => sensorsWithLatest.filter((r) => String(r.machine.id) === String(selectedMachineId)),
    [sensorsWithLatest, selectedMachineId]
  )

  return (
    <OperatorLayout pageTitle="Surveillance">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surveillance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mesures capteurs en temps réel. Consultation uniquement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-gray-400">
              Mise à jour : {formatDateTime(lastUpdate)}
            </span>
          )}
          <button
            type="button"
            onClick={() => load({ silent: true })}
            disabled={refreshing}
            title="Actualiser"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : machines.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <EmptyState
            icon={Wrench}
            title="Aucune machine accessible"
            description="Aucune machine n'est disponible pour votre ligne."
            className="py-12"
          />
        </div>
      ) : (
        <>
          {/* Compteurs par statut (NORMAL / DEGRADE / CRITIQUE / HORS_LIGNE) */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            {[
              { key: 'NORMAL', label: 'Machines normales', bg: 'bg-green-50 text-green-700' },
              { key: 'DEGRADE', label: 'Machines dégradées', bg: 'bg-orange-50 text-orange-700' },
              { key: 'CRITIQUE', label: 'Machines critiques', bg: 'bg-red-50 text-red-700' },
              { key: 'HORS_LIGNE', label: 'Machines hors ligne', bg: 'bg-gray-100 text-gray-700' },
            ].map((s) => (
              <div key={s.key} className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`mt-1 inline-block rounded-md px-2 py-0.5 text-lg font-bold ${s.bg}`}>
                  {counts[s.key]}
                </p>
              </div>
            ))}
          </div>

          {anomalies.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                {anomalies.length} valeur(s) hors plage détectée(s)
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Signalement visuel uniquement — le statut de la machine n'est pas modifié automatiquement.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            {/* Machines de la ligne */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900 text-sm">Mes machines</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {machines.length} machine{machines.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
                {machines.map((m) => {
                  const rows = sensorsWithLatest.filter((r) => r.machine.id === m.id)
                  const lastMeasure = rows
                    .map((r) => r.reading)
                    .filter(Boolean)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
                  const selected = String(selectedMachineId) === String(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMachineId(selected ? null : m.id)}
                      className={`w-full text-left px-5 py-3.5 hover:bg-gray-50 ${
                        selected ? 'bg-primary-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{m.nom}</p>
                          <p className="text-xs text-gray-400">
                            {m.identifiant_interne}
                            {m.ligne_production_nom ? ` · ${m.ligne_production_nom}` : ''}
                          </p>
                        </div>
                        <MachineStatusBadge status={m.statut} />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {lastMeasure
                          ? `Dernière mesure : ${lastMeasure.valeur} ${
                              rows.find((r) => r.reading?.id === lastMeasure.id)?.capteur.unite ?? ''
                            } — ${formatDateTime(lastMeasure.timestamp)}`
                          : 'Aucune mesure disponible'}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {rows.length} capteur{rows.length > 1 ? 's' : ''}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Capteurs + dernière valeur */}
            <div className="xl:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900 text-sm">
                  {selectedMachine
                    ? `Capteurs — ${selectedMachine.nom}`
                    : 'Capteurs et dernières mesures'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Valeur, unité, seuils et heure de la dernière mesure
                </p>
              </div>

              {selectedMachine && sensorsWithLatest.length > 0 && selectedRows.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="Aucun capteur"
                  description="Cette machine n'a aucun capteur associé."
                  className="py-12"
                />
              ) : selectedMachine ? (
                <SensorTable rows={selectedRows} />
              ) : sensorsWithLatest.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="Aucun capteur disponible"
                  description="Aucun capteur n'est associé aux machines accessibles."
                  className="py-12"
                />
              ) : (
                <>
                  <SensorTable rows={sensorsWithLatest} />
                  <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-50">
                    Sélectionnez une machine pour filtrer la liste.
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </OperatorLayout>
  )
}

function SensorTable({ rows }) {
  return (
    <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {['Capteur', 'Type', 'Machine', 'Valeur', 'Unité', 'Seuils', 'Dernière mesure'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map(({ machine, capteur, reading, horsPlage, typeLabel }) => (
            <tr
              key={`${machine.id}-${capteur.id}`}
              className={horsPlage ? 'bg-red-50/40' : 'hover:bg-gray-50'}
              data-testid="sensor-row"
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <p className="text-sm font-medium text-gray-900">{capteur.nom}</p>
                <p className="text-xs font-mono text-gray-400">{capteur.identifiant}</p>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{typeLabel}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                {machine.nom}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {reading ? (
                  <span
                    className={`text-sm font-bold ${
                      horsPlage ? 'text-red-600' : 'text-gray-800'
                    }`}
                  >
                    {reading.valeur}
                    {horsPlage && (
                      <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-xs font-medium text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        hors plage
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{capteur.unite}</td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                {capteur.seuil_min} – {capteur.seuil_max} {capteur.unite}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                {reading ? formatDateTime(reading.timestamp) : 'Aucune mesure'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}