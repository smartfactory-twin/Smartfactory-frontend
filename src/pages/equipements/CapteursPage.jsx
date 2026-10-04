import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Upload, FileUp, Download, Trash2, Edit, Eye, Activity } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import Spinner from '../../components/common/Spinner'
import Alert from '../../components/common/Alert'
import { useAuthContext } from '../../context/AuthContext'
import { getCapteurs, deleteCapteur } from '../../services/sensorService'
import { getMachines } from '../../services/machineService'

export default function CapteursPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const role = user?.role

  const [capteurs, setCapteurs] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMachine, setFilterMachine] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [capteursRes, machinesRes] = await Promise.all([
        getCapteurs({ page_size: 100 }),
        getMachines({ page_size: 100 })
      ])
      setCapteurs(capteursRes.results || capteursRes)
      setMachines(machinesRes.results || machinesRes)
    } catch (err) {
      setError('Impossible de charger les données.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce capteur ?')) return
    try {
      await deleteCapteur(id)
      fetchData()
    } catch (err) {
      alert('Erreur lors de la suppression.')
    }
  }

  const filtered = capteurs.filter(c => {
    const matchesSearch = (c.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.identifiant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.machine_nom?.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesMachine = !filterMachine || c.machine === parseInt(filterMachine)
    const matchesType = !filterType || c.type_capteur === filterType
    const matchesStatus = !filterStatus || String(c.actif) === filterStatus
    return matchesSearch && matchesMachine && matchesType && matchesStatus
  })

  const sensorTypes = [
    { value: 'TEMPERATURE', label: 'Température' },
    { value: 'VIBRATION', label: 'Vibration' },
    { value: 'PRESSION', label: 'Pression' },
    { value: 'COURANT', label: 'Courant' },
    { value: 'VITESSE_RPM', label: 'Vitesse (RPM)' },
    { value: 'DEBIT', label: 'Débit' },
    { value: 'NIVEAU_SONORE', label: 'Niveau sonore' },
  ]

  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary-600" />
              Gestion des Capteurs
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Gérer les capteurs associés aux machines et leurs données IoT
            </p>
          </div>
          {role === 'ADMIN' && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/capteurs/nouveau')}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter un capteur
              </button>
              <button
                onClick={() => navigate('/capteurs/import-sensors')}
                className="btn-secondary flex items-center gap-2"
              >
                <FileUp className="h-4 w-4" />
                Importer des capteurs
              </button>
              <button
                onClick={() => navigate('/capteurs/import-readings')}
                className="btn-secondary flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Importer des mesures
              </button>
            </div>
          )}
        </div>

        {error && <Alert type="error" message={error} />}

        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, identifiant ou machine..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterMachine}
                onChange={(e) => setFilterMachine(e.target.value)}
                className="input-field"
              >
                <option value="">Toutes les machines</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nom} ({m.identifiant_interne})
                  </option>
                ))}
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input-field"
              >
                <option value="">Tous les types</option>
                {sensorTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-field"
              >
                <option value="">Tous les statuts</option>
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capteur</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Machine</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fréquence</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seuils</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{c.nom}</div>
                          <div className="text-sm text-gray-500 font-mono">{c.identifiant}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {sensorTypes.find(t => t.value === c.type_capteur)?.label || c.type_capteur}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{c.machine_nom}</div>
                        <div className="text-sm text-gray-500 font-mono">{c.machine_identifiant}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.unite}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.frequence_mesure}s</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {c.seuil_min} / {c.seuil_max} {c.unite}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          c.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {c.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => navigate(`/capteurs/${c.id}`)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Voir détails"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {role === 'ADMIN' && (
                          <>
                            <button
                              onClick={() => navigate(`/capteurs/${c.id}/modifier`)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Modifier"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Aucun capteur trouvé.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
