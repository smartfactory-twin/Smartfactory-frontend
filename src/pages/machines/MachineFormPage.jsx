import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Camera, Maximize2, Trash2 } from 'lucide-react'
import { useAuthContext } from '../../context/AuthContext'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import Spinner from '../../components/common/Spinner'
import Alert from '../../components/common/Alert'
import ImageLightbox from '../../components/common/ImageLightbox'
import {
  getMachine, createMachine, updateMachine,
  getUsines, getZones, getLignes,
} from '../../services/machineService'

const STATUTS = [
  { value: 'NORMAL',     label: 'Normal' },
  { value: 'DEGRADE',    label: 'Dégradé' },
  { value: 'CRITIQUE',   label: 'Critique' },
  { value: 'HORS_LIGNE', label: 'Hors ligne' },
]

export default function MachineFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const isEdit = Boolean(id)

  const [usines, setUsines]   = useState([])
  const [zones, setZones]     = useState([])
  const [lignes, setLignes]   = useState([])
  const [selectedUsine, setSelectedUsine] = useState('')
  const [selectedZone, setSelectedZone]   = useState('')
  const [photoPreview, setPhotoPreview]   = useState(null)
  const [photoFile, setPhotoFile]         = useState(null)
  const [photoRemoved, setPhotoRemoved]   = useState(false)
  const [showLightbox, setShowLightbox]   = useState(false)
  const [loadingInit, setLoadingInit]     = useState(isEdit)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)
  const photoInputRef = useRef(null)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    defaultValues: { statut: 'NORMAL' }
  })

  // Charger usines
  useEffect(() => {
    getUsines({ page_size: 200 }).then(d => setUsines(d.results ?? d)).catch(() => {})
  }, [])

  // Charger zones quand usine change
  useEffect(() => {
    if (!selectedUsine) { setZones([]); setLignes([]); return }
    getZones({ usine: selectedUsine, page_size: 200 })
      .then(d => setZones(d.results ?? d))
      .catch(() => {})
    setLignes([])
    setSelectedZone('')
    setValue('ligne_production', '')
  }, [selectedUsine, setValue])

  // Charger lignes quand zone change
  useEffect(() => {
    if (!selectedZone) { setLignes([]); return }
    getLignes({ zone: selectedZone, page_size: 200 })
      .then(d => setLignes(d.results ?? d))
      .catch(() => {})
    setValue('ligne_production', '')
  }, [selectedZone, setValue])

  // Pré-remplir en mode édition
  useEffect(() => {
    if (!isEdit) return
    getMachine(id)
      .then(m => {
        reset({
          nom:                m.nom,
          identifiant_interne: m.identifiant_interne,
          numero_serie:       m.numero_serie ?? '',
          marque:             m.marque ?? '',
          modele:             m.modele ?? '',
          date_installation:  m.date_installation ?? '',
          description:        m.description ?? '',
          position_sur_plan:  m.position_sur_plan ?? '',
          statut:             m.statut,
          ligne_production:   m.ligne_production ?? '',
        })
        if (m.photo) setPhotoPreview(m.photo)
        // Cascades : on ne peut pas pré-sélectionner usine/zone sans données supplémentaires
        // mais ligne_production_id est déjà dans le formulaire
      })
      .catch(() => setError('Impossible de charger la machine.'))
      .finally(() => setLoadingInit(false))
  }, [id, isEdit, reset])

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setPhotoRemoved(false)
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoRemoved(true)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const buildFormData = (data) => {
    const fd = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (k === 'photo') return
      if (v !== '' && v !== null && v !== undefined) fd.append(k, v)
    })
    if (photoFile) fd.append('photo', photoFile)
    return fd
  }

  const onSubmit = async (data) => {
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        if (photoFile) {
          // Une nouvelle photo a été choisie → PATCH multipart
          await updateMachine(id, buildFormData(data))
        } else {
          // PATCH JSON (champs seuls, ou suppression de la photo)
          const payload = { ...data }
          delete payload.photo
          if (!payload.ligne_production) payload.ligne_production = null
          if (photoRemoved) payload.photo = null
          await updateMachine(id, payload)
        }
      } else {
        // POST multipart (avec photo potentielle)
        await createMachine(buildFormData(data))
      }
      navigate('/machines')
    } catch (err) {
      const detail = err?.response?.data
      if (typeof detail === 'object') {
        const msg = Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
        setError(msg)
      } else {
        setError('Une erreur est survenue.')
      }
    } finally {
      setSaving(false)
    }
  }

  const Layout = user?.role === 'TECHNICIEN' ? TechnicianLayout : AdminLayout
  const pageTitle = isEdit ? 'Modifier la machine' : 'Ajouter une machine'

  if (loadingInit) return (
    <Layout pageTitle={pageTitle}>
      <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
    </Layout>
  )

  return (
    <Layout pageTitle={pageTitle}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{pageTitle}</h1>
            <p className="text-sm text-gray-500">{isEdit ? `Modification de la machine #${id}` : 'Créer une nouvelle machine'}</p>
          </div>
        </div>

        {error && <Alert type="error" message={error} dismissible className="mb-4" />}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Identité */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Identité</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
                <input
                  {...register('nom', { required: 'Le nom est obligatoire.' })}
                  className={`input-field ${errors.nom ? 'input-error' : ''}`}
                  placeholder="Ex: Presse hydraulique A1"
                />
                {errors.nom && <p className="mt-1 text-xs text-red-600">{errors.nom.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Identifiant interne *</label>
                <input
                  {...register('identifiant_interne', { required: "L'identifiant est obligatoire." })}
                  className={`input-field ${errors.identifiant_interne ? 'input-error' : ''}`}
                  placeholder="Ex: MCH-A01"
                />
                {errors.identifiant_interne && <p className="mt-1 text-xs text-red-600">{errors.identifiant_interne.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">N° de série</label>
                <input {...register('numero_serie')} className="input-field" placeholder="Ex: SN-2024-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Marque</label>
                <input {...register('marque')} className="input-field" placeholder="Ex: Siemens" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Modèle</label>
                <input {...register('modele')} className="input-field" placeholder="Ex: S7-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Statut</label>
                <select {...register('statut')} className="input-field">
                  {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Installation */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Installation</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date d'installation</label>
                <input type="date" {...register('date_installation')} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Position sur plan</label>
                <input {...register('position_sur_plan')} className="input-field" placeholder="Ex: Zone B, rangée 3" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Description de la machine…"
                />
              </div>
            </div>
          </div>

          {/* Localisation cascade */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Localisation</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Usine</label>
                <select
                  value={selectedUsine}
                  onChange={e => setSelectedUsine(e.target.value)}
                  className="input-field"
                >
                  <option value="">— Sélectionner —</option>
                  {usines.map(u => <option key={u.id} value={u.id}>{u.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Zone</label>
                <select
                  value={selectedZone}
                  onChange={e => setSelectedZone(e.target.value)}
                  disabled={!selectedUsine}
                  className="input-field disabled:opacity-50"
                >
                  <option value="">— Sélectionner —</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ligne de production</label>
                <select
                  {...register('ligne_production')}
                  disabled={!selectedZone}
                  className="input-field disabled:opacity-50"
                >
                  <option value="">— Sélectionner —</option>
                  {lignes.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Photo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Photo</h2>
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => photoPreview && setShowLightbox(true)}
                disabled={!photoPreview}
                title={photoPreview ? 'Agrandir la photo' : undefined}
                className={`group relative h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0 ${photoPreview ? 'cursor-zoom-in' : 'cursor-default'}`}
              >
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="Aperçu de la machine" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/40">
                      <Maximize2 className="h-5 w-5 text-white" />
                    </span>
                  </>
                ) : (
                  <Camera className="h-8 w-8 text-gray-300" />
                )}
              </button>
              <div>
                <input
                  ref={photoInputRef}
                  id="photo-input"
                  type="file"
                  accept="image/*"
                  onChange={onPhotoChange}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="photo-input"
                    className="cursor-pointer px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 inline-block">
                    {photoPreview ? 'Changer la photo' : 'Choisir une photo'}
                  </label>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" /> Retirer
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2">JPG, PNG, WebP · Max 5 Mo</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pb-6">
            <button type="button" onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer la machine'}
            </button>
          </div>
        </form>
      </div>

      {showLightbox && photoPreview && (
        <ImageLightbox
          src={photoPreview}
          alt="Aperçu de la machine"
          onClose={() => setShowLightbox(false)}
        />
      )}
    </Layout>
  )
}
