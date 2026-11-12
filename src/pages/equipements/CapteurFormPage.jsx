import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import Spinner from '../../components/common/Spinner'
import Alert from '../../components/common/Alert'
import { useAuthContext } from '../../context/AuthContext'
import { createCapteur, updateCapteur, getCapteur } from '../../services/sensorService'
import { getMachines } from '../../services/machineService'

const SENSOR_TYPES = [
  { value: 'TEMPERATURE', label: 'Température', unit: '°C' },
  { value: 'VIBRATION', label: 'Vibration', unit: 'mm/s' },
  { value: 'PRESSION', label: 'Pression', unit: 'bar' },
  { value: 'COURANT', label: 'Courant', unit: 'A' },
  { value: 'VITESSE_RPM', label: 'Vitesse', unit: 'RPM' },
  { value: 'DEBIT', label: 'Débit', unit: 'L/min' },
  { value: 'NIVEAU_SONORE', label: 'Niveau sonore', unit: 'dB' },
]
const SENSOR_UNIT_BY_TYPE = Object.fromEntries(SENSOR_TYPES.map(({ value, unit }) => [value, unit]))

export default function CapteurFormPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const role = user?.role
  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(isEdit)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    identifiant: '',
    nom: '',
    type_capteur: 'TEMPERATURE',
    machine: '',
    unite: SENSOR_UNIT_BY_TYPE.TEMPERATURE,
    frequence_mesure: '',
    seuil_min: '',
    seuil_max: '',
    actif: true,
    description: '',
  })

  useEffect(() => {
    getMachines({ page_size: 200 }).then(res => {
      setMachines(res.results || res)
    })
  }, [])

  useEffect(() => {
    if (isEdit) {
      setLoadingData(true)
      getCapteur(id).then(data => {
        setFormData({
          identifiant: data.identifiant || '',
          nom: data.nom || '',
          type_capteur: data.type_capteur || 'TEMPERATURE',
          machine: data.machine || '',
          unite: SENSOR_UNIT_BY_TYPE[data.type_capteur] || data.unite || '',
          frequence_mesure: data.frequence_mesure ?? '',
          seuil_min: data.seuil_min ?? '',
          seuil_max: data.seuil_max ?? '',
          actif: data.actif ?? true,
          description: data.description || '',
        })
      }).catch(() => {
        setError('Impossible de charger les données du capteur.')
      }).finally(() => {
        setLoadingData(false)
      })
    }
  }, [id, isEdit])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      ...formData,
      unite: SENSOR_UNIT_BY_TYPE[formData.type_capteur] || formData.unite,
      machine: parseInt(formData.machine),
      frequence_mesure: parseInt(formData.frequence_mesure),
      seuil_min: parseFloat(formData.seuil_min),
      seuil_max: parseFloat(formData.seuil_max),
    }

    try {
      if (isEdit) {
        await updateCapteur(id, payload)
      } else {
        await createCapteur(payload)
      }
      navigate('/capteurs')
    } catch (err) {
      const msg = err?.response?.data?.detail ||
                  err?.response?.data?.non_field_errors?.[0] ||
                  Object.values(err?.response?.data || {})?.[0]?.[0] ||
                  'Erreur lors de l\'enregistrement.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'type_capteur' ? { unite: SENSOR_UNIT_BY_TYPE[value] || '' } : {}),
    }))
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/capteurs')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Modifier le capteur' : 'Ajouter un capteur'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configurez le capteur et ses seuils de mesure
            </p>
          </div>
        </div>

        {error && <Alert type="error" message={error} />}

        {loadingData ? (
          <div className="card p-8 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Identifiant unique *
                </label>
                <input
                  type="text"
                  name="identifiant"
                  value={formData.identifiant}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du capteur *
                </label>
                <input
                  type="text"
                  name="nom"
                  value={formData.nom}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Machine associée *
                </label>
                <select
                  name="machine"
                  value={formData.machine}
                  onChange={handleChange}
                  className="input-field"
                  required
                >
                  <option value="">Sélectionner une machine</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nom} - {m.identifiant_interne}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de capteur *
                </label>
                <select
                  name="type_capteur"
                  value={formData.type_capteur}
                  onChange={handleChange}
                  className="input-field"
                  required
                >
                  {SENSOR_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label} ({t.unit})</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-500">Unité attribuée automatiquement : <strong>{SENSOR_UNIT_BY_TYPE[formData.type_capteur]}</strong></p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fréquence (secondes) *
                </label>
                <input
                  type="number"
                  name="frequence_mesure"
                  value={formData.frequence_mesure}
                  onChange={handleChange}
                  className="input-field"
                  min="1"
                  required
                />
              </div>
              <div className="flex items-center pt-8">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="actif"
                    checked={formData.actif}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary-600 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Capteur actif</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seuil minimum *
                </label>
                <input
                  type="number"
                  name="seuil_min"
                  value={formData.seuil_min}
                  onChange={handleChange}
                  className="input-field"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seuil maximum *
                </label>
                <input
                  type="number"
                  name="seuil_max"
                  value={formData.seuil_max}
                  onChange={handleChange}
                  className="input-field"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="input-field"
                placeholder="Description du capteur..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate('/capteurs')}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {isEdit ? 'Enregistrer' : 'Créer'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  )
}
