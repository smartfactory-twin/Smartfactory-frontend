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
const SENSOR_ROLE_BY_TYPE = {
  TEMPERATURE: 'temperature',
  VIBRATION: 'vibration',
  PRESSION: 'pressure',
  DEBIT: 'flow',
  COURANT: 'current',
  VITESSE_RPM: 'speed',
  NIVEAU_SONORE: 'other',
}
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
    criticality: 'medium', is_ai_eligible: false,
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const sensorRole = SENSOR_ROLE_BY_TYPE[formData.type_capteur] || 'other'
  const boundsComplete = formData.seuil_min !== '' && formData.seuil_max !== ''
  const boundsValid = boundsComplete && Number.isFinite(Number(formData.seuil_min)) && Number.isFinite(Number(formData.seuil_max)) && Number(formData.seuil_min) < Number(formData.seuil_max)
  const eligibilityDisabled = sensorRole === 'other' || !boundsValid
  const eligibilityReason = sensorRole === 'other'
    ? 'Ce type de capteur ne possède pas de rôle IA compatible.'
    : 'Renseignez les deux seuils avec un minimum inférieur au maximum.'

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
          actif: data.actif ?? true,
          description: data.description || '',
          seuil_min: data.seuil_min ?? data.nominal_min ?? '',
          seuil_max: data.seuil_max ?? data.nominal_max ?? '',
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
    if (formData.seuil_min !== '' && formData.seuil_max !== '' && Number(formData.seuil_min) >= Number(formData.seuil_max)) {
      nextErrors.seuil_min = 'Le seuil minimum doit être inférieur au seuil maximum.'
    }
    if (formData.is_ai_eligible && eligibilityDisabled) nextErrors.is_ai_eligible = eligibilityReason
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
      sensor_role: sensorRole,
      nominal_min: formData.seuil_min === '' || formData.seuil_max === '' ? null : Number(formData.seuil_min),
      nominal_max: formData.seuil_min === '' || formData.seuil_max === '' ? null : Number(formData.seuil_max),
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
      const mapped = Object.fromEntries(Object.entries(data)
        .filter(([key]) => key !== 'detail' && key !== 'non_field_errors')
        .map(([key, value]) => {
          const visibleField = ({ nominal_min: 'seuil_min', nominal_max: 'seuil_max', sensor_role: 'type_capteur' })[key] || key
          return [visibleField, asFieldMessage(value)]
        })
        .filter(([, value]) => value))
      setFieldErrors(mapped)
      setError(data.detail || asFieldMessage(data.non_field_errors) || (Object.keys(mapped).length ? '' : 'Erreur lors de l\'enregistrement.'))
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFieldErrors((prev) => ({ ...prev, [name]: undefined, ...(name === 'seuil_min' || name === 'seuil_max' ? { seuil_min: undefined, seuil_max: undefined } : {}) }))
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...((name === 'type_capteur' && (SENSOR_ROLE_BY_TYPE[value] || 'other') === 'other') ? { is_ai_eligible: false } : {}),
      ...((name === 'seuil_min' || name === 'seuil_max') && (!value || !(name === 'seuil_min' ? prev.seuil_max : prev.seuil_min)) ? { is_ai_eligible: false } : {}),
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

            <section className="border-t pt-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Seuils de mesure</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seuil d’alerte minimum
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
                    Seuil d’alerte maximum
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700" title={eligibilityDisabled ? eligibilityReason : 'Autoriser ce capteur pour les traitements IA.'}>
                  <input type="checkbox" name="is_ai_eligible" checked={formData.is_ai_eligible} disabled={eligibilityDisabled} onChange={handleChange} /> Éligible pour l’IA
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  Criticité
                  <select name="criticality" value={formData.criticality} onChange={handleChange} className="input-field w-auto py-2">{CRITICALITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  <FieldError>{fieldErrors.criticality}</FieldError>
                </label>
              </div>
              {eligibilityDisabled && <p className="text-xs text-gray-500" title={eligibilityReason}>{eligibilityReason}</p>}
              <FieldError>{fieldErrors.is_ai_eligible}</FieldError>
            </section>

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
