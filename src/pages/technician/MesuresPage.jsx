import { useEffect, useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import Spinner from '../../components/common/Spinner'
import Alert from '../../components/common/Alert'
import EmptyState from '../../components/common/EmptyState'
import { getMachines } from '../../services/machineService'
import { getCapteurs, getReadings } from '../../services/sensorService'
import api from '../../services/api'

const formatDateTime = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return String(value)
  }
}

const parseDateTimeLocal = (value) => {
  if (!value) return ''
  // Convert to ISO-like for backend filter (YYYY-MM-DDTHH:mm)
  const date = new Date(value)
  return date.toISOString()
}

export default function MesuresPage() {
  const [machines, setMachines] = useState([])
  const [capteurs, setCapteurs] = useState([])
  const [readings, setReadings] = useState([])
  const [loadingMachines, setLoadingMachines] = useState(false)
  const [loadingCapteurs, setLoadingCapteurs] = useState(false)
  const [loadingReadings, setLoadingReadings] = useState(false)
  const [error, setError] = useState(null)
  const [selectedMachine, setSelectedMachine] = useState('')
  const [selectedCapteur, setSelectedCapteur] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const pageSize = 25

  useEffect(() => {
    const fetchMachines = async () => {
      setLoadingMachines(true)
      try {
        const data = await getMachines({ limit: 200 })
        const list = data?.results ?? data ?? []
        setMachines(list)
      } catch (err) {
        console.error('Erreur lors du chargement des machines', err)
        setError(err?.response?.data?.detail || "Impossible de charger les machines.")
      } finally {
        setLoadingMachines(false)
      }
    }
    fetchMachines()
  }, [])

  useEffect(() => {
    setSelectedCapteur('')
    setCapteurs([])
    if (!selectedMachine) return
    const fetchCapteurs = async () => {
      setLoadingCapteurs(true)
      try {
        const data = await getCapteurs({ machine: selectedMachine, limit: 200 })
        const list = data?.results ?? data ?? []
        setCapteurs(list)
      } catch (err) {
        console.error('Erreur lors du chargement des capteurs', err)
        setError(err?.response?.data?.detail || "Impossible de charger les capteurs.")
      } finally {
        setLoadingCapteurs(false)
      }
    }
    fetchCapteurs()
  }, [selectedMachine])

  useEffect(() => {
    const fetchReadings = async () => {
      if (!selectedCapteur) {
        setReadings([])
        setCount(0)
        return
      }
      setLoadingReadings(true)
      setError(null)
      try {
        const params = {
          sensor: selectedCapteur,
          ordering: '-timestamp',
          page,
          limit: pageSize,
        }
        if (dateFrom) {
          // datetime-local renvoie YYYY-MM-DDTHH:mm ; ajouter secondes pour compatibilité
          params.timestamp__gte = dateFrom.length === 16 ? `${dateFrom}:00` : dateFrom
        }
        if (dateTo) {
          params.timestamp__lte = dateTo.length === 16 ? `${dateTo}:00` : dateTo
        }
        const data = await getReadings(params)
        const list = data?.results ?? data ?? []
        setReadings(list)
        setCount(data?.count ?? list.length)
      } catch (err) {
        console.error('Erreur lors du chargement des mesures', err)
        setError(err?.response?.data?.detail || "Impossible de charger les mesures.")
      } finally {
        setLoadingReadings(false)
      }
    }
    fetchReadings()
  }, [selectedCapteur, dateFrom, dateTo, page])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count])

  const selectedCapteurInfo = useMemo(() =>
    capteurs.find(c => String(c.id) === String(selectedCapteur) || c.identifiant === selectedCapteur),
    [capteurs, selectedCapteur]
  )

  const selectedMachineInfo = useMemo(() =>
    machines.find(m => String(m.id) === String(selectedMachine)),
    [machines, selectedMachine]
  )

  return (
    <TechnicianLayout pageTitle="Mesures">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Historique des mesures capteurs</h1>
        <p className="text-sm text-gray-500 mt-1">Consultez les mesures des capteurs associés aux machines.</p>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Machine</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={selectedMachine}
              onChange={(e) => { setSelectedMachine(e.target.value); setPage(1) }}
            >
              <option value="">Sélectionner une machine</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>{m.nom} ({m.identifiant_interne})</option>
              ))}
            </select>
            {loadingMachines && <span className="text-xs text-gray-500 mt-1">Chargement...</span>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Capteur</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={selectedCapteur}
              onChange={(e) => { setSelectedCapteur(e.target.value); setPage(1) }}
              disabled={!selectedMachine || loadingCapteurs}
            >
              <option value="">Sélectionner un capteur</option>
              {capteurs.map(c => (
                <option key={c.id} value={c.id}>{c.nom} - {c.identifiant} ({c.type_capteur})</option>
              ))}
            </select>
            {loadingCapteurs && <span className="text-xs text-gray-500 mt-1">Chargement...</span>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date début</label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date fin</label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Historique des mesures</h2>
          <span className="text-xs text-gray-500">
            {selectedCapteurInfo && selectedMachineInfo ?
              `${selectedMachineInfo.nom} • ${selectedCapteurInfo.nom} (${selectedCapteurInfo.unite})` :
              'Sélectionnez un capteur'
            }
          </span>
        </div>
        {loadingReadings ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !selectedCapteur ? (
          <EmptyState
            icon={Activity}
            title="Aucun capteur sélectionné"
            description="Sélectionnez une machine puis un capteur pour afficher l'historique des mesures."
            className="py-10"
          />
        ) : readings.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Aucune mesure trouvée"
            description="Aucune mesure n'existe pour ce capteur avec les filtres sélectionnés."
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Heure</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valeur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unité</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capteur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Machine</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hors plage</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {readings.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateTime(r.timestamp)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{r.valeur}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{r.sensor?.unite || selectedCapteurInfo?.unite}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{r.sensor?.identifiant || selectedCapteurInfo?.identifiant}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{r.sensor?.machine?.nom || selectedMachineInfo?.nom}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{r.hors_plage ? 'Oui' : 'Non'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {count > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">Page {page} sur {totalPages} ({count} mesures)</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-50"
                  >Précédent</button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-50"
                  >Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </TechnicianLayout>
  )
}
