import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Trash2, MapPin, Calendar, Tag,
  FileText, Package, Camera, Plus, X, Check, Maximize2,
} from 'lucide-react'
import { useAuthContext } from '../../context/AuthContext'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { MachineStatusBadge } from '../../components/common/StatusBadge'
import Spinner from '../../components/common/Spinner'
import ImageLightbox from '../../components/common/ImageLightbox'
import { getMachine, deleteMachine } from '../../services/machineService'
import { addMachineComposant, updateComposant, deleteComposant } from '../../services/equipementService'

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-primary-600" />
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function ConfirmDeleteDialog({ nom, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-bold text-gray-900 mb-2">Supprimer la machine</h3>
        <p className="text-sm text-gray-600 mb-5">
          Voulez-vous vraiment supprimer <span className="font-semibold">{nom}</span> ? Cette action est irréversible.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Gestion inline des composants ────────────────────────────────────────────
function ComposantsSection({ machineId, initialComposants, canEdit }) {
  const [composants, setComposants] = useState(initialComposants)
  const [showAdd, setShowAdd]       = useState(false)
  const [editId, setEditId]         = useState(null)
  const [deleteId, setDeleteId]     = useState(null)
  const [deleting, setDeleting]     = useState(false)

  // Formulaire add/edit
  const [nom, setNom]           = useState('')
  const [piece, setPiece]       = useState('')
  const [desc, setDesc]         = useState('')
  const [saving, setSaving]     = useState(false)

  const startEdit = (c) => {
    setEditId(c.id); setNom(c.nom); setPiece(c.numero_piece ?? ''); setDesc(c.description ?? '')
    setShowAdd(false)
  }
  const startAdd = () => {
    setEditId(null); setNom(''); setPiece(''); setDesc(''); setShowAdd(true)
  }
  const cancelForm = () => { setShowAdd(false); setEditId(null) }

  const handleSave = async () => {
    if (!nom.trim()) return
    setSaving(true)
    try {
      if (editId) {
        const updated = await updateComposant(editId, { nom: nom.trim(), numero_piece: piece.trim(), description: desc.trim() })
        setComposants(cs => cs.map(c => c.id === editId ? updated : c))
        setEditId(null)
      } else {
        const created = await addMachineComposant(machineId, { nom: nom.trim(), numero_piece: piece.trim(), description: desc.trim() })
        setComposants(cs => [...cs, created])
        setShowAdd(false)
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteComposant(deleteId)
      setComposants(cs => cs.filter(c => c.id !== deleteId))
      setDeleteId(null)
    } finally { setDeleting(false) }
  }

  return (
    <Section title={`Composants (${composants.length})`} icon={Package}>
      {composants.length === 0 && !showAdd ? (
        <p className="text-sm text-gray-400 mb-3">Aucun composant associé.</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {composants.map(c => (
            <li key={c.id}>
              {editId === c.id ? (
                // Formulaire d'édition inline
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <input value={nom} onChange={e => setNom(e.target.value)}
                    className="input-field text-xs py-1" placeholder="Nom du composant *" autoFocus />
                  <input value={piece} onChange={e => setPiece(e.target.value)}
                    className="input-field text-xs py-1" placeholder="Réf. pièce (optionnel)" />
                  <textarea value={desc} onChange={e => setDesc(e.target.value)}
                    rows={2} className="input-field text-xs py-1 resize-none" placeholder="Description (optionnel)" />
                  <div className="flex gap-2">
                    <button onClick={handleSave} disabled={saving || !nom.trim()}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      <Check className="h-3 w-3" /> {saving ? '…' : 'Sauvegarder'}
                    </button>
                    <button onClick={cancelForm}
                      className="flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                      <X className="h-3 w-3" /> Annuler
                    </button>
                  </div>
                </div>
              ) : (
                // Affichage normal
                <div className="flex items-start justify-between gap-2 p-2 bg-gray-50 rounded-lg group">
                  <div className="flex items-start gap-2 min-w-0">
                    <Package className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700">{c.nom}</p>
                      {c.numero_piece && <p className="text-xs text-gray-400">Réf: {c.numero_piece}</p>}
                      {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => startEdit(c)}
                        className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(c.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Formulaire d'ajout */}
      {showAdd && (
        <div className="p-2 bg-green-50 border border-green-200 rounded-lg space-y-2 mb-3">
          <input value={nom} onChange={e => setNom(e.target.value)}
            className="input-field text-xs py-1" placeholder="Nom du composant *" autoFocus />
          <input value={piece} onChange={e => setPiece(e.target.value)}
            className="input-field text-xs py-1" placeholder="Réf. pièce (optionnel)" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            rows={2} className="input-field text-xs py-1 resize-none" placeholder="Description (optionnel)" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !nom.trim()}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              <Check className="h-3 w-3" /> {saving ? '…' : 'Ajouter'}
            </button>
            <button onClick={cancelForm}
              className="flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              <X className="h-3 w-3" /> Annuler
            </button>
          </div>
        </div>
      )}

      {canEdit && !showAdd && editId === null && (
        <button onClick={startAdd}
          className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
          <Plus className="h-3.5 w-3.5" /> Ajouter un composant
        </button>
      )}

      {/* Confirm delete composant */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-xs mx-4">
            <p className="text-sm font-medium text-gray-900 mb-4">
              Supprimer ce composant ? Cette action est irréversible.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700">Annuler</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? '…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}

export default function MachineDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const role = user?.role

  const [machine, setMachine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [showPhoto, setShowPhoto]   = useState(false)

  useEffect(() => {
    setLoading(true)
    getMachine(id)
      .then(setMachine)
      .catch(err => {
        if (err?.response?.status === 404) setError('404')
        else setError('Erreur lors du chargement.')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteMachine(id)
      navigate('/machines', { replace: true })
    } catch {
      setDeleting(false)
    }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  if (loading) return (
    <Layout pageTitle="Machines">
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    </Layout>
  )

  if (error) return (
    <Layout pageTitle="Machines">
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">{error === '404' ? 'Machine introuvable.' : error}</p>
        <button onClick={() => navigate('/machines')} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </button>
      </div>
    </Layout>
  )

  return (
    <Layout pageTitle={machine.nom}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/machines')}
            className="mt-0.5 p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{machine.nom}</h1>
              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-mono rounded-lg">
                {machine.identifiant_interne}
              </span>
              <MachineStatusBadge status={machine.statut} />
            </div>
            {machine.marque && (
              <p className="text-sm text-gray-500 mt-1">{machine.marque} {machine.modele && `· ${machine.modele}`}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 ml-10 sm:ml-0">
          {(role === 'ADMIN' || role === 'TECHNICIEN') && (
            <button onClick={() => navigate(`/machines/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              <Pencil className="h-4 w-4" /> Modifier
            </button>
          )}
          {role === 'ADMIN' && (
            <button onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100">
              <Trash2 className="h-4 w-4" /> Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Grille */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Identité */}
        <Section title="Identité" icon={Tag}>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Nom" value={machine.nom} />
            <InfoRow label="Identifiant" value={machine.identifiant_interne} />
            <InfoRow label="N° Série" value={machine.numero_serie} />
            <InfoRow label="Marque" value={machine.marque} />
            <InfoRow label="Modèle" value={machine.modele} />
          </div>
        </Section>

        {/* Installation */}
        <Section title="Installation" icon={Calendar}>
          <div className="grid grid-cols-1 gap-4">
            <InfoRow label="Date d'installation" value={formatDate(machine.date_installation)} />
            <InfoRow label="Description" value={machine.description} />
          </div>
        </Section>

        {/* Localisation */}
        <Section title="Localisation" icon={MapPin}>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-gray-400">Usine</span>
              <span className="mx-1 text-gray-300">›</span>
              <span>{machine.usine_nom ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-gray-400">Zone</span>
              <span className="mx-1 text-gray-300">›</span>
              <span>{machine.zone_nom ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-gray-400">Ligne</span>
              <span className="mx-1 text-gray-300">›</span>
              <span>{machine.ligne_production_nom ?? '—'}</span>
            </div>
            <InfoRow label="Position sur plan" value={machine.position_sur_plan} />
          </div>
        </Section>

        {/* Photo */}
        <Section title="Photo" icon={Camera}>
          {machine.photo ? (
            <button
              type="button"
              onClick={() => setShowPhoto(true)}
              title="Agrandir la photo"
              className="group relative block w-full cursor-zoom-in overflow-hidden rounded-lg border border-gray-200"
            >
              <img src={machine.photo} alt={machine.nom}
                className="w-full h-48 object-cover transition-transform duration-200 group-hover:scale-105" />
              <span className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100 p-2">
                <span className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                  <Maximize2 className="h-3.5 w-3.5" /> Agrandir
                </span>
              </span>
            </button>
          ) : (
            <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Camera className="h-8 w-8 mx-auto mb-2" />
                <p className="text-xs">Aucune photo</p>
              </div>
            </div>
          )}
        </Section>

        {/* Documents */}
        <Section title={`Documents (${machine.documents?.length ?? 0})`} icon={FileText}>
          {machine.documents?.length === 0 || !machine.documents ? (
            <p className="text-sm text-gray-400">Aucun document associé.</p>
          ) : (
            <ul className="space-y-2">
              {machine.documents.map(doc => (
                <li key={doc.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{doc.nom}</p>
                      <p className="text-xs text-gray-400">{doc.type_document}</p>
                    </div>
                  </div>
                  {doc.fichier && (
                    <a href={doc.fichier} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary-600 hover:underline flex-shrink-0">
                      Télécharger
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Composants — CRUD inline */}
        <ComposantsSection
          machineId={machine.id}
          initialComposants={machine.composants ?? []}
          canEdit={role === 'ADMIN'}
        />
      </div>

      {showPhoto && machine.photo && (
        <ImageLightbox src={machine.photo} alt={machine.nom} onClose={() => setShowPhoto(false)} />
      )}

      {showDelete && (
        <ConfirmDeleteDialog
          nom={machine.nom}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          loading={deleting}
        />
      )}
    </Layout>
  )
}
