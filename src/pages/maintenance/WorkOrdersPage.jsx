import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Wrench, Plus, Calendar, Activity, ChevronLeft, ChevronRight,
  X, FileText, ClipboardList, Check, Clock, AlertTriangle,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import { useAuthContext } from '../../context/AuthContext'
import {
  getWorkOrders, createWorkOrder, updateWorkOrderStatus,
  submitReport, getRecurring, addRecurring,
} from '../../services/workOrderService'
import { getMachines } from '../../services/machineService'

/* ── Constantes ──────────────────────────────────────────────────────────── */

const WORKFLOW = ['Créé', 'Assigné', 'En cours', 'En attente pièces', 'Rapport déposé', 'Validé', 'Clôturé']
const TYPES = ['Corrective', 'Préventive', 'Inspection']
const PRIORITIES = ['Haute', 'Moyenne', 'Basse']
const prioBadge = { Haute: 'bg-red-100 text-red-800', Moyenne: 'bg-yellow-100 text-yellow-800', Basse: 'bg-emerald-100 text-emerald-800' }

const fmtDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
const fmtDateTime = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const eur = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
const woCost = (w) => {
  if (!w.rapport) return 0
  return (w.rapport.pieces || []).reduce((a, p) => a + (p.qte || 0) * (p.cout || 0), 0)
}

/* ── Composant principal ─────────────────────────────────────────────────── */

export default function WorkOrdersPage() {
  const { user } = useAuthContext()
  const role = user?.role ?? 'OPERATEUR'
  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  const [tab, setTab] = useState('board')
  const [wos, setWos] = useState([])
  const [machines, setMachines] = useState([])
  const [recurring, setRecurring] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Modals
  const [newOpen, setNewOpen] = useState(false)
  const [detailWo, setDetailWo] = useState(null)
  const [reportWo, setReportWo] = useState(null)
  const [recurOpen, setRecurOpen] = useState(false)

  // Calendar
  const [calDate, setCalDate] = useState(new Date())

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [woData, recurringData, machData] = await Promise.all([
        getWorkOrders(),
        getRecurring(),
        getMachines({ page_size: 200 }).then((d) => d.results ?? d ?? []).catch(() => []),
      ])
      setWos(Array.isArray(woData) ? woData : [])
      setRecurring(Array.isArray(recurringData) ? recurringData : [])
      setMachines(Array.isArray(machData) ? machData : [])
    } catch (error) {
      setWos([])
      setRecurring([])
      setLoadError(error.response?.data?.detail || 'Impossible de charger les ordres de travail. Vérifie que le backend est démarré.')
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const advanceStatus = async (wo, target) => {
    try {
      await updateWorkOrderStatus(wo.id, target)
      await reload()
      if (detailWo) {
        const updated = (await getWorkOrders()).find((w) => w.id === wo.id)
        setDetailWo(updated || null)
      }
    } catch (error) {
      setLoadError(error.response?.data?.statut?.[0] || error.response?.data?.detail || 'Impossible de modifier le statut de cet OT.')
    }
  }

  /* ── Tabs ─────────────────────────────────────────────────────────────── */

  const tabs = [
    { key: 'board', label: 'Ordres de travail', Icon: Wrench },
    { key: 'cal', label: 'Calendrier', Icon: Calendar },
    { key: 'kpi', label: 'Indicateurs', Icon: Activity },
  ]

  return (
    <Layout pageTitle="Maintenance">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
          {role !== 'OPERATEUR' && (
            <button onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              <Plus className="h-4 w-4" /> Nouvel OT
            </button>
          )}
        </div>

      {loadError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}

        {/* Tab content */}
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100" />)}
          </div>
        ) : tab === 'board' ? (
          <KanbanBoard wos={wos} onSelect={setDetailWo} />
        ) : tab === 'cal' ? (
          <CalendarView wos={wos} recurring={recurring} calDate={calDate} setCalDate={setCalDate} machines={machines} onRecur={() => setRecurOpen(true)} />
        ) : (
          <KpiView wos={wos} />
        )}
      </div>

      {/* ── Modals ── */}
      {newOpen && <NewOtModal machines={machines} onClose={() => setNewOpen(false)} onCreated={async () => { setNewOpen(false); await reload() }} />}
      {detailWo && <DetailModal wo={detailWo} role={role} onClose={() => setDetailWo(null)} onAdvance={advanceStatus} onReport={(w) => { setDetailWo(null); setReportWo(w) }} />}
      {reportWo && <ReportModal wo={reportWo} onClose={() => setReportWo(null)} onSubmitted={async () => { setReportWo(null); await reload() }} />}
      {recurOpen && <RecurModal machines={machines} onClose={() => setRecurOpen(false)} onAdded={async () => { setRecurOpen(false); await reload() }} />}
    </Layout>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   KANBAN BOARD
   ═══════════════════════════════════════════════════════════════════════ */

function KanbanBoard({ wos, onSelect }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 320 }}>
      {WORKFLOW.map((status) => {
        const items = wos.filter((w) => w.statut === status)
        return (
          <div key={status} className="min-w-[210px] max-w-[260px] flex-1 flex flex-col">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{status}</span>
              <span className="text-xs font-mono text-gray-400">{items.length}</span>
            </div>
            <div className="flex-1 space-y-2 rounded-lg bg-gray-50 p-2">
              {items.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Aucun OT</p>
              ) : items.map((w) => (
                <button key={w.id} type="button" onClick={() => onSelect(w)}
                  className="w-full rounded-lg bg-white border border-gray-200 p-3 text-left shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-500">OT {w.id}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${prioBadge[w.priorite] || 'bg-slate-100'}`}>{w.priorite}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{w.titre}</p>
                  <p className="text-xs text-gray-500 mb-2">{w.machine_nom}</p>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">{w.type}</span>
                    <span className="text-[10px] text-gray-400">{w.assigne}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   OT DETAIL MODAL
   ═══════════════════════════════════════════════════════════════════════ */

function DetailModal({ wo, role, onClose, onAdvance, onReport }) {
  const idx = WORKFLOW.indexOf(wo.statut)
  const next = WORKFLOW[idx + 1]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">OT {wo.id}</p>
            <h3 className="mt-1 text-lg font-bold text-gray-900">{wo.titre}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Info row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${prioBadge[wo.priorite]}`}>{wo.priorite}</span>
            <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium">{wo.type}</span>
            <span className="font-semibold text-gray-900">{wo.machine_nom}</span>
            <span className="text-sm text-gray-500">Assigné à {wo.assigne} · échéance {fmtDate(wo.echeance)}</span>
          </div>

          {/* Pipeline */}
          <div className="flex flex-wrap items-center gap-1">
            {WORKFLOW.map((s, k) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  k < idx ? 'bg-emerald-100 text-emerald-800'
                  : k === idx ? 'bg-primary-100 text-primary-800 ring-2 ring-primary-500'
                  : 'bg-gray-100 text-gray-500'
                }`}>{s}</span>
                {k < WORKFLOW.length - 1 && <span className="text-gray-300 text-xs">›</span>}
              </span>
            ))}
          </div>

          {/* Rapport */}
          {wo.rapport && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <h4 className="font-bold text-gray-900 flex items-center gap-2"><FileText className="h-4 w-4" /> Rapport d'intervention</h4>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Travaux</p>
                <p className="text-sm text-gray-800">{wo.rapport.travaux}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Pièces</p>
                {(wo.rapport.pieces || []).length === 0
                  ? <p className="text-sm text-gray-400">Aucune pièce</p>
                  : wo.rapport.pieces.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm font-mono text-gray-700">
                      <span>{p.ref} × {p.qte}</span>
                      <span>{eur(p.cout * p.qte)}</span>
                    </div>
                  ))
                }
              </div>
              <div className="flex flex-wrap gap-3">
                <span className="rounded-md bg-white border border-gray-200 px-2 py-1 text-xs">{wo.rapport.duree} h</span>
                <span className="rounded-md bg-white border border-gray-200 px-2 py-1 text-xs">Coût {eur(woCost(wo))}</span>
                <span className="rounded-md bg-white border border-gray-200 px-2 py-1 text-xs">Signé : {wo.rapport.signataire}</span>
              </div>
              {wo.rapport.signature_data_url && <img src={wo.rapport.signature_data_url} alt={`Signature de ${wo.rapport.signataire}`} className="max-h-16 max-w-56 rounded border border-gray-200 bg-white p-1" />}
              {wo.rapport.observations && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Observations</p>
                  <p className="text-sm text-gray-700">{wo.rapport.observations}</p>
                </div>
              )}
            </div>
          )}

          {/* Historique */}
          <div className="text-xs text-gray-500">
            Historique : {(wo.historique || []).map((h) => `${h.statut} (${fmtDateTime(h.date)})`).join(' → ')}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
            {(wo.statut === 'En cours' || wo.statut === 'En attente pièces') && (
              <button onClick={() => onReport(wo)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                <FileText className="h-4 w-4" /> Saisir le rapport
              </button>
            )}
            {wo.statut === 'En cours' && (
              <button onClick={() => onAdvance(wo, 'En attente pièces')}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Clock className="h-4 w-4" /> En attente de pièces
              </button>
            )}
            {next && next !== 'Rapport déposé' && !(next === 'Validé' && role !== 'ADMIN') && (
              <button onClick={() => onAdvance(wo, next)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Check className="h-4 w-4" /> Passer à « {next} »
              </button>
            )}
            {next === 'Validé' && role !== 'ADMIN' && (
              <span className="text-sm text-gray-500 italic">Validation réservée à l'administrateur.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   NEW OT MODAL
   ═══════════════════════════════════════════════════════════════════════ */

function NewOtModal({ machines, onClose, onCreated }) {
  const [machineId, setMachineId] = useState(machines[0]?.id || '')
  const [type, setType] = useState('Corrective')
  const [prio, setPrio] = useState('Moyenne')
  const [assigne, setAssigne] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!desc.trim()) { setError('La description est requise.'); return }
    setSaving(true)
    const mach = machines.find((m) => String(m.id) === String(machineId))
    setError('')
    try {
      await createWorkOrder({
        machine_id: machineId,
        machine_nom: mach?.nom || `Machine #${machineId}`,
        type,
        priorite: prio,
        titre: desc.trim(),
        assigne: assigne || '—',
      })
      await onCreated()
    } catch (exception) {
      setError(exception.response?.data?.detail || exception.response?.data?.machine_id?.[0] || 'Impossible de créer cet ordre de travail.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Nouvel ordre de travail</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Machine</label>
            <select value={machineId} onChange={(e) => setMachineId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
              {machines.map((m) => <option key={m.id} value={m.id}>{m.identifiant_interne || m.id} · {m.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
            <select value={prio} onChange={(e) => setPrio(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigné à</label>
            <select value={assigne} onChange={(e) => setAssigne(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
              <option value="">— Non assigné —</option>
              <option>Mohamed K.</option>
              <option>Sirine B.</option>
              <option>Ali R.</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
            placeholder="Décrivez le travail à réaliser…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !machines.length}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
            <Plus className="h-4 w-4" /> {saving ? 'Création…' : "Créer l'OT"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPORT MODAL (with signature canvas)
   ═══════════════════════════════════════════════════════════════════════ */

function ReportModal({ wo, onClose, onSubmitted }) {
  const { user } = useAuthContext()
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [inked, setInked] = useState(false)
  const [travaux, setTravaux] = useState('')
  const [pieces, setPieces] = useState([])
  const [pieceRef, setPieceRef] = useState('')
  const [pieceQte, setPieceQte] = useState(1)
  const [pieceCout, setPieceCout] = useState(20)
  const [duree, setDuree] = useState(2)
  const [observations, setObservations] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const getPos = (e) => {
    const cv = canvasRef.current
    const r = cv.getBoundingClientRect()
    return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]
  }

  const onPointerDown = (e) => {
    setDrawing(true)
    const cv = canvasRef.current
    cv.setPointerCapture(e.pointerId)
    const c = cv.getContext('2d')
    c.lineWidth = 3
    c.lineCap = 'round'
    c.strokeStyle = '#000'
    const p = getPos(e)
    c.beginPath()
    c.moveTo(...p)
  }
  const onPointerMove = (e) => {
    if (!drawing) return
    const c = canvasRef.current.getContext('2d')
    const p = getPos(e)
    c.lineTo(...p)
    c.stroke()
    setInked(true)
  }
  const onPointerUp = () => setDrawing(false)
  const clearCanvas = () => {
    const cv = canvasRef.current
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height)
    setInked(false)
  }

  const addPiece = () => {
    if (!pieceRef.trim()) return
    setPieces([...pieces, { ref: pieceRef.trim(), qte: pieceQte || 1, cout: pieceCout || 0 }])
    setPieceRef('')
  }

  const handleSubmit = async () => {
    if (!travaux.trim()) { setError('Décrivez les travaux réalisés.'); return }
    if (!inked) { setError('Signez dans le cadre pour valider.'); return }
    setSaving(true)
    setError('')
    try {
      await submitReport(wo.id, {
        travaux: travaux.trim(),
        pieces,
        duree: duree || 0,
        observations,
        signataire: `${user?.prenom || ''} ${user?.nom || ''}`.trim() || 'Technicien',
        signature_data_url: canvasRef.current.toDataURL('image/png'),
      })
      await onSubmitted()
    } catch (exception) {
      setError(exception.response?.data?.detail || 'Impossible d’enregistrer le rapport d’intervention.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Rapport d'intervention · OT {wo.id}</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          {/* Travaux */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Travaux réalisés</label>
            <textarea value={travaux} onChange={(e) => setTravaux(e.target.value)} rows={3}
              placeholder="Décrivez les travaux…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>

          {/* Pièces */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pièces utilisées</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input value={pieceRef} onChange={(e) => setPieceRef(e.target.value)} placeholder="Référence"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              <input type="number" min="1" value={pieceQte} onChange={(e) => setPieceQte(+e.target.value)} placeholder="Qté"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <input type="number" min="0" value={pieceCout} onChange={(e) => setPieceCout(+e.target.value)} placeholder="Coût €"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <button onClick={addPiece} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            {pieces.map((p, i) => (
              <div key={i} className="flex justify-between text-sm font-mono text-gray-700 px-1">
                <span>{p.ref} × {p.qte}</span>
                <span>{eur(p.cout * p.qte)}</span>
              </div>
            ))}
          </div>

          {/* Durée + Observations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée réelle (h)</label>
              <input type="number" min="0" step="0.25" value={duree} onChange={(e) => setDuree(+e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
              <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Signature canvas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Signature numérique</label>
            <canvas ref={canvasRef} width={600} height={140}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
              className="w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 touch-none" style={{ maxWidth: 600, height: 'auto' }} />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500">Signataire : {user?.prenom} {user?.nom}</span>
              <button onClick={clearCanvas} className="text-xs text-gray-600 hover:text-gray-900">Effacer</button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
            <button onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
              <FileText className="h-4 w-4" /> {saving ? 'Envoi…' : 'Déposer le rapport'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CALENDAR VIEW
   ═══════════════════════════════════════════════════════════════════════ */

function CalendarView({ wos, recurring, calDate, setCalDate, machines, onRecur }) {
  const y = calDate.getFullYear()
  const mo = calDate.getMonth()
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7
  const daysInMonth = new Date(y, mo + 1, 0).getDate()
  const today = new Date()
  // Build events map
  const events = {}
  const addEvent = (day, label, isCorrectif) => {
    if (!events[day]) events[day] = []
    events[day].push({ label, isCorrectif })
  }
  wos.filter((w) => w.statut !== 'Clôturé').forEach((w) => {
    const d = new Date(w.echeance)
    if (d.getMonth() === mo && d.getFullYear() === y) {
      addEvent(d.getDate(), `OT ${w.id} ${w.machine_nom}`, w.type === 'Corrective')
    }
  })
  recurring.forEach((r) => {
    const startDate = r.date_debut ? new Date(`${r.date_debut}T00:00:00`) : new Date()
    for (let t = startDate; t <= new Date(y, mo + 1, 0); t = new Date(t.getTime() + r.frequence_jours * 86400e3)) {
      if (t.getMonth() === mo && t.getFullYear() === y) {
        addEvent(t.getDate(), `↻ ${r.machine_nom} ${r.titre}`, false)
      }
      if (t.getFullYear() > y + 1) break
    }
  })

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button onClick={() => setCalDate(new Date(y, mo - 1, 1))} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-bold text-gray-900 capitalize">
          {calDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setCalDate(new Date(y, mo + 1, 1))} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button onClick={onRecur}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Calendar className="h-4 w-4" /> Préventive récurrente
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4">
        <div className="grid grid-cols-7 gap-px">
          {dayNames.map((d) => <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>)}
          {[...Array(offset)].map((_, i) => <div key={`o${i}`} className="p-2" />)}
          {[...Array(daysInMonth)].map((_, i) => {
            const n = i + 1
            const isToday = n === today.getDate() && mo === today.getMonth() && y === today.getFullYear()
            const evts = events[n] || []
            return (
              <div key={n} className={`p-1.5 min-h-[70px] rounded-lg border ${isToday ? 'border-primary-300 bg-primary-50' : 'border-transparent hover:bg-gray-50'}`}>
                <span className={`text-xs font-semibold ${isToday ? 'text-primary-700' : 'text-gray-700'}`}>{n}</span>
                {evts.slice(0, 3).map((e, j) => (
                  <div key={j} title={e.label}
                    className={`mt-0.5 truncate rounded px-1 text-[9px] font-medium ${e.isCorrectif ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'}`}>
                    {e.label}
                  </div>
                ))}
                {evts.length > 3 && <span className="text-[9px] text-gray-400">+{evts.length - 3}</span>}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-100">
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block h-3 w-3 rounded border border-primary-400 bg-primary-100" /> OT / préventif
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block h-3 w-3 rounded border border-red-400 bg-red-100" /> OT correctif
          </span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   RECURRING MAINTENANCE MODAL
   ═══════════════════════════════════════════════════════════════════════ */

function RecurModal({ machines, onClose, onAdded }) {
  const [mid, setMid] = useState(machines[0]?.id || '')
  const [freq, setFreq] = useState(30)
  const [titre, setTitre] = useState('Contrôle périodique')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    const m = machines.find((x) => String(x.id) === String(mid))
    setSaving(true)
    setError('')
    try {
      await addRecurring({ machine_id: mid, machine_nom: m?.nom || `Machine #${mid}`, frequence_jours: freq || 30, titre: titre || 'Préventif' })
      await onAdded()
    } catch (exception) {
      setError(exception.response?.data?.detail || 'Impossible d’enregistrer ce plan préventif.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Maintenance préventive récurrente</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Machine</label>
            <select value={mid} onChange={(e) => setMid(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
              {machines.map((m) => <option key={m.id} value={m.id}>{m.identifiant_interne || m.id} · {m.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence (jours)</label>
            <input type="number" min="1" value={freq} onChange={(e) => setFreq(+e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Intervention</label>
          <input value={titre} onChange={(e) => setTitre(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </div>
        {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">Annuler</button>
          <button onClick={handleAdd} disabled={saving || !machines.length}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            <Calendar className="h-4 w-4" /> {saving ? 'Enregistrement…' : 'Planifier'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   KPI VIEW
   ═══════════════════════════════════════════════════════════════════════ */

function KpiView({ wos }) {
  const reported = wos.filter((w) => w.rapport)
  const mttr = reported.length > 0 ? reported.reduce((a, w) => a + (w.rapport.duree || 0), 0) / reported.length : 0
  const now = new Date()
  const monthlyReports = reported.filter((w) => {
    const reportDate = new Date(w.rapport.date_depot || w.updated_at || w.created_at)
    return reportDate.getMonth() === now.getMonth() && reportDate.getFullYear() === now.getFullYear()
  })
  const openCount = wos.filter((w) => w.statut !== 'Clôturé').length
  const closedCount = wos.length - openCount

  // Cost by machine
  const costMap = {}
  monthlyReports.forEach((w) => { costMap[w.machine_nom] = (costMap[w.machine_nom] || 0) + woCost(w) })
  const topCosts = Object.entries(costMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxCost = Math.max(...topCosts.map(([, v]) => v), 1)

  // OT by status
  const statusCounts = WORKFLOW.map((s) => ({ label: s.split(' ')[0], count: wos.filter((w) => w.statut === s).length }))
  const maxCount = Math.max(...statusCounts.map((s) => s.count), 1)

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'MTBF', value: 'N/D', sub: 'historique de fonctionnement requis' },
          { label: 'MTTR', value: reported.length ? `${mttr.toFixed(1)} h` : 'N/D', sub: `${reported.length} rapports enregistrés` },
          { label: 'Disponibilité', value: 'N/D', sub: 'heures de marche et d’arrêt requises' },
          { label: 'OT ouverts / clôturés', value: `${openCount} / ${closedCount}`, sub: `${wos.length} au total` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Cost per machine */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-200"><h3 className="font-bold text-gray-900">Coût des pièces par machine (ce mois)</h3></div>
          <div className="p-4 space-y-3">
            {topCosts.length === 0 ? <p className="text-sm text-gray-400">Aucune donnée</p> : topCosts.map(([label, val]) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{label}</span>
                  <span className="font-mono text-gray-900">{eur(val)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${(val / maxCost) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OT per status */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-200"><h3 className="font-bold text-gray-900">OT par état</h3></div>
          <div className="p-4 space-y-3">
            {statusCounts.map(({ label, count }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{label}</span>
                  <span className="font-mono text-gray-900">{count}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: label === 'Clôturé' || label === 'Validé' ? '#10b981' : '#6366f1' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
