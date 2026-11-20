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
const SENSOR_ROLES = ['temperature', 'vibration', 'pressure', 'flow', 'current', 'speed', 'other']
const CRITICALITIES = ['low', 'medium', 'high']

function FieldError({ children }) {
  return children ? <p className="mt-1 text-xs text-red-600" role="alert">{children}</p> : null
}

function asFieldMessage(value) {
  if (Array.isArray(value)) return value.join(' ')
  return typeof value === 'string' ? value : ''
}

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
    sensor_role: 'other', nominal_min: '', nominal_max: '', criticality: 'medium', is_ai_eligible: false,
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const nominalComplete = formData.nominal_min !== '' && formData.nominal_max !== '' && Number.isFinite(Number(formData.nominal_min)) && Number.isFinite(Number(formData.nominal_max))
  const nominalValid = nominalComplete && Number(formData.nominal_min) < Number(formData.nominal_max)
  const eligibilityDisabled = formData.sensor_role === 'other' || !nominalValid
  const eligibilityReason = formData.sensor_role === 'other' ? 'Choisissez un rôle différent de « other ».' : 'Renseignez deux bornes nominales valides, avec min < max.'

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
          sensor_role: data.sensor_role || 'other', nominal_min: data.nominal_min ?? '', nominal_max: data.nominal_max ?? '',
          criticality: data.criticality || 'medium', is_ai_eligible: Boolean(data.is_ai_eligible),
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
    const nextErrors = {}
    const hasNominalMin = formData.nominal_min !== ''
    const hasNominalMax = formData.nominal_max !== ''
    if (hasNominalMin !== hasNominalMax) nextErrors.nominal_min = 'Les deux bornes nominales doivent être renseignées ensemble.'
    else if (hasNominalMin && Number(formData.nominal_min) >= Number(formData.nominal_max)) nextErrors.nominal_min = 'La borne minimum doit être inférieure à la borne maximum.'
    if (formData.is_ai_eligible && (formData.sensor_role === 'other' || !nominalValid)) nextErrors.is_ai_eligible = 'Un rôle pris en charge et deux bornes nominales valides sont requis.'
    if (Object.keys(nextErrors).length) { setFieldErrors(nextErrors); return }
    setFieldErrors({})
    setLoading(true)
    setError(null)

    const payload = {
      ...formData,
      unite: SENSOR_UNIT_BY_TYPE[formData.type_capteur] || formData.unite,
      machine: parseInt(formData.machine),
      frequence_mesure: parseInt(formData.frequence_mesure),
      seuil_min: formData.seuil_min === '' ? null : Number(formData.seuil_min),
      seuil_max: formData.seuil_max === '' ? null : Number(formData.seuil_max),
      nominal_min: formData.nominal_min === '' ? null : Number(formData.nominal_min),
      nominal_max: formData.nominal_max === '' ? null : Number(formData.nominal_max),
    }

    try {
      if (isEdit) {
        await updateCapteur(id, payload)
      } else {
        await createCapteur(payload)
      }
      navigate('/capteurs')
    } catch (err) {
      const data = err?.response?.data || {}
      const mapped = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'detail' && key !== 'non_field_errors').map(([key, value]) => [key, asFieldMessage(value)]).filter(([, value]) => value))
      setFieldErrors(mapped)
      setError(data.detail || asFieldMessage(data.non_field_errors) || (Object.keys(mapped).length ? '' : 'Erreur lors de l\'enregistrement.'))
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFieldErrors((prev) => ({ ...prev, [name]: undefined, ...(name === 'nominal_min' || name === 'nominal_max' ? { nominal_min: undefined, nominal_max: undefined } : {}) }))
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'sensor_role' && value === 'other' ? { is_ai_eligible: false } : {}),
      ...((name === 'nominal_min' || name === 'nominal_max') && (!value || !prev.nominal_min || !prev.nominal_max) ? { is_ai_eligible: false } : {}),
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Identifiant unique *</label>
                <input type="text" name="identifiant" value={formData.identifiant} onChange={handleChange} className="input-field" required />
                <FieldError>{fieldErrors.identifiant}</FieldError>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom du capteur *</label>
                <input type="text" name="nom" value={formData.nom} onChange={handleChange} className="input-field" required />
                <FieldError>{fieldErrors.nom}</FieldError>
              </div>
            </div>

            <section className="border-t pt-5 space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Métadonnées IA</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm font-medium text-gray-700">Rôle du capteur
                  <select name="sensor_role" value={formData.sensor_role} onChange={handleChange} className="input-field mt-2">{SENSOR_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  <FieldError>{fieldErrors.sensor_role}</FieldError>
                </label>
                <label className="block text-sm font-medium text-gray-700">Criticité
                  <select name="criticality" value={formData.criticality} onChange={handleChange} className="input-field mt-2">{CRITICALITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  <FieldError>{fieldErrors.criticality}</FieldError>
                </label>
                <label className="block text-sm font-medium text-gray-700">Minimum nominal
                  <input type="number" step="any" name="nominal_min" value={formData.nominal_min} onChange={handleChange} className="input-field mt-2" />
                  <FieldError>{fieldErrors.nominal_min}</FieldError>
                </label>
                <label className="block text-sm font-medium text-gray-700">Maximum nominal
                  <input type="number" step="any" name="nominal_max" value={formData.nominal_max} onChange={handleChange} className="input-field mt-2" />
                  <FieldError>{fieldErrors.nominal_max}</FieldError>
                </label>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700" title={eligibilityDisabled ? eligibilityReason : 'Autoriser ce capteur pour les traitements IA.'}>
                <input type="checkbox" name="is_ai_eligible" checked={formData.is_ai_eligible} disabled={eligibilityDisabled} onChange={handleChange} /> Éligible pour l’IA
              </label>
              {eligibilityDisabled && <p className="text-xs text-gray-500" title={eligibilityReason}>{eligibilityReason}</p>}
              <FieldError>{fieldErrors.is_ai_eligible}</FieldError>
            </section>

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
                <FieldError>{fieldErrors.machine}</FieldError>
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
                <FieldError>{fieldErrors.type_capteur}</FieldError>
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
                <FieldError>{fieldErrors.frequence_mesure || fieldErrors.sampling_period_seconds}</FieldError>
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
                  <FieldError>{fieldErrors.actif}</FieldError>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seuil minimum
                </label>
                <input
                  type="number"
                  name="seuil_min"
                  value={formData.seuil_min}
                  onChange={handleChange}
                  className="input-field"
                  step="any"
                />
                <FieldError>{fieldErrors.seuil_min}</FieldError>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seuil maximum
                </label>
                <input
                  type="number"
                  name="seuil_max"
                  value={formData.seuil_max}
                  onChange={handleChange}
                  className="input-field"
                  step="any"
                />
                <FieldError>{fieldErrors.seuil_max}</FieldError>
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
              <FieldError>{fieldErrors.description}</FieldError>
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
