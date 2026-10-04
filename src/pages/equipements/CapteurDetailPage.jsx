import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Activity, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import Spinner from '../../components/common/Spinner'
import Alert from '../../components/common/Alert'
import { useAuthContext } from '../../context/AuthContext'
import { getCapteur, getReadings } from '../../services/sensorService'

export default function CapteurDetailPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const { id } = useParams()

  const role = user?.role
  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  const [capteur, setCapteur] = useState(null)
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getCapteur(id),
      getReadings({ sensor: id, ordering: '-timestamp', page_size: 10 })
    ]).then(([capteurData, readingsData]) => {
      setCapteur(capteurData)
      setReadings(readingsData.results || readingsData)
    }).catch(() => {
      setError('Impossible de charger les données du capteur.')
    }).finally(() => {
      setLoading(false)
    })
  }, [id])

  const sensorTypes = {
    TEMPERATURE: 'Température',
    VIBRATION: 'Vibration',
    PRESSION: 'Pression',
    COURANT: 'Courant',
    VITESSE_RPM: 'Vitesse (RPM)',
    DEBIT: 'Débit',
    NIVEAU_SONORE: 'Niveau sonore',
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </Layout>
    )
  }

  if (error || !capteur) {
    return (
      <Layout>
        <Alert type="error" message={error || 'Capteur introuvable.'} />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/capteurs')}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Activity className="h-7 w-7 text-primary-600" />
                {capteur.nom}
              </h1>
              <p className="text-sm text-gray-500 mt-1 font-mono">{capteur.identifiant}</p>
            </div>
          </div>
          {role === 'ADMIN' && (
            <button
              onClick={() => navigate(`/capteurs/${id}/modifier`)}
              className="btn-primary flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Modifier
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Type de capteur</p>
                <p className="text-sm font-medium text-gray-900">
                  {sensorTypes[capteur.type_capteur] || capteur.type_capteur}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Machine associée</p>
                <p className="text-sm font-medium text-gray-900">{capteur.machine_nom}</p>
                <p className="text-xs text-gray-500 font-mono">{capteur.machine_identifiant}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Unité</p>
                <p className="text-sm font-medium text-gray-900">{capteur.unite}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Fréquence</p>
                <p className="text-sm font-medium text-gray-900">{capteur.frequence_mesure} secondes</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Statut</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                  capteur.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {capteur.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Seuils de configuration</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Seuil minimum</p>
                <p className="text-2xl font-bold text-blue-600">{capteur.seuil_min} {capteur.unite}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Seuil maximum</p>
                <p className="text-2xl font-bold text-orange-600">{capteur.seuil_max} {capteur.unite}</p>
              </div>
              {capteur.description && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm text-gray-700">{capteur.description}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6 md:col-span-2 lg:col-span-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              Dernières lectures
            </h2>
            {readings.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">Aucune lecture disponible</p>
            ) : (
              <div className="space-y-3">
                {readings.map((r) => (
                  <div key={r.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {r.valeur} {capteur.unite}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(r.timestamp).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="ml-2">
                      {r.hors_plage ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" title="Hors plage" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" title="Dans la plage" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
