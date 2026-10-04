import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Layers, GitBranch, Wrench, Package,
  ChevronRight, ChevronDown, RefreshCw, Upload, Download,
} from 'lucide-react'
import { useAuthContext } from '../../context/AuthContext'
import AdminLayout from '../../components/layout/AdminLayout'
import TechnicianLayout from '../../components/layout/TechnicianLayout'
import OperatorLayout from '../../components/layout/OperatorLayout'
import Spinner from '../../components/common/Spinner'
import Alert from '../../components/common/Alert'
import { MachineStatusBadge } from '../../components/common/StatusBadge'
import { getUsines, getUsineHierarchie, exportHierarchyCsv } from '../../services/equipementService'
import HierarchyCsvImportModal from '../../components/equipements/HierarchyCsvImportModal'

// ── Nœud Composant ────────────────────────────────────────────────────────────
function ComposantNode({ composant }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-2">
      <Package className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
      <span className="text-xs text-gray-600">{composant.nom}</span>
      {composant.numero_piece && (
        <span className="text-xs text-gray-400 font-mono">#{composant.numero_piece}</span>
      )}
    </div>
  )
}

// ── Nœud Machine ──────────────────────────────────────────────────────────────
function MachineNode({ machine, navigate }) {
  const [open, setOpen] = useState(false)
  const hasComposants = machine.composants?.length > 0

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 rounded-lg hover:bg-gray-50 px-2 group">
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${hasComposants ? 'text-gray-400' : 'text-transparent'}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <Wrench className="h-4 w-4 text-orange-500 flex-shrink-0" />
        <button
          onClick={() => navigate(`/machines/${machine.id}`)}
          className="text-sm text-gray-800 hover:text-primary-600 font-medium text-left flex-1"
        >
          {machine.nom}
        </button>
        <span className="text-xs text-gray-400 font-mono hidden group-hover:inline">{machine.identifiant_interne}</span>
        <MachineStatusBadge status={machine.statut} />
      </div>

      {open && hasComposants && (
        <div className="ml-9 border-l border-gray-200 pl-3 mt-0.5 mb-1">
          {machine.composants.map(c => <ComposantNode key={c.id} composant={c} />)}
        </div>
      )}
    </div>
  )
}

// ── Nœud Ligne ────────────────────────────────────────────────────────────────
function LigneNode({ ligne, navigate }) {
  const [open, setOpen] = useState(false)
  const hasMachines = ligne.machines?.length > 0

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 rounded-lg hover:bg-gray-50 px-2">
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${hasMachines ? 'text-gray-400' : 'text-transparent'}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <GitBranch className="h-4 w-4 text-green-600 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700">{ligne.nom}</span>
        <span className="text-xs text-gray-400">
          {ligne.machines?.length ?? 0} machine{(ligne.machines?.length ?? 0) !== 1 ? 's' : ''}
        </span>
      </div>

      {open && hasMachines && (
        <div className="ml-9 border-l border-gray-200 pl-3 mt-0.5 mb-1 space-y-0.5">
          {ligne.machines.map(m => <MachineNode key={m.id} machine={m} navigate={navigate} />)}
        </div>
      )}
    </div>
  )
}

// ── Nœud Zone ─────────────────────────────────────────────────────────────────
function ZoneNode({ zone, navigate }) {
  const [open, setOpen] = useState(false)
  const hasLignes = zone.lignes?.length > 0

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 rounded-lg hover:bg-gray-50 px-2">
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${hasLignes ? 'text-gray-400' : 'text-transparent'}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <Layers className="h-4 w-4 text-blue-600 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700">{zone.nom}</span>
        <span className="text-xs text-gray-400">
          {zone.lignes?.length ?? 0} ligne{(zone.lignes?.length ?? 0) !== 1 ? 's' : ''}
        </span>
      </div>

      {open && hasLignes && (
        <div className="ml-9 border-l border-gray-200 pl-3 mt-0.5 mb-1 space-y-0.5">
          {zone.lignes.map(l => <LigneNode key={l.id} ligne={l} navigate={navigate} />)}
        </div>
      )}
    </div>
  )
}

// ── Carte Usine ───────────────────────────────────────────────────────────────
function UsineCard({ usine, navigate }) {
  const [open, setOpen]       = useState(false)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const toggle = async () => {
    if (!open && !data) {
      setLoading(true); setError(null)
      try {
        const h = await getUsineHierarchie(usine.id)
        setData(h)
        setOpen(true)
      } catch { setError('Erreur de chargement.') }
      finally { setLoading(false) }
    } else {
      setOpen(v => !v)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header usine */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="h-10 w-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-5 w-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{usine.nom}</p>
          {usine.adresse && <p className="text-xs text-gray-400 truncate">{usine.adresse}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {usine.zones_count ?? 0} zone{(usine.zones_count ?? 0) !== 1 ? 's' : ''}
          </span>
          {loading
            ? <Spinner size="sm" />
            : <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
          }
        </div>
      </button>

      {/* Arbre hiérarchique */}
      {open && data && (
        <div className="border-t border-gray-100 px-5 py-3">
          {data.zones?.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Aucune zone dans cette usine.</p>
          ) : (
            <div className="space-y-0.5">
              {data.zones.map(z => <ZoneNode key={z.id} zone={z} navigate={navigate} />)}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="border-t border-gray-100 px-5 py-3">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function HierarchiePage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const role = user?.role

  const [usines, setUsines]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [exporting, setExporting]       = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [bannerMsg, setBannerMsg]       = useState(null)

  const fetchUsines = () => {
    setLoading(true); setError(null)
    getUsines({ page_size: 200 })
      .then(d => setUsines(d.results ?? d))
      .catch(() => setError('Impossible de charger les usines.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsines() }, [])

  const handleExportCsv = async () => {
    setExporting(true)
    setBannerMsg(null)
    try {
      await exportHierarchyCsv()
      setBannerMsg({ type: 'success', text: 'Export CSV téléchargé avec succès.' })
    } catch (err) {
      setBannerMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors de l’export CSV.' })
    } finally {
      setExporting(false)
    }
  }

  const handleImportSuccess = () => {
    fetchUsines()
    setBannerMsg({ type: 'success', text: 'La hiérarchie des équipements a été mise à jour avec succès.' })
  }

  const Layout = role === 'ADMIN' ? AdminLayout : role === 'TECHNICIEN' ? TechnicianLayout : OperatorLayout

  return (
    <Layout pageTitle="Hiérarchie des équipements">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vue hiérarchique</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Explorez la structure complète Usine → Zone → Ligne → Machine → Composant
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {role === 'ADMIN' && (
            <>
              <button
                onClick={() => { setBannerMsg(null); setIsImportOpen(true) }}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                <Upload className="h-4 w-4" />
                <span>Importer CSV</span>
              </button>

              <button
                onClick={handleExportCsv}
                disabled={exporting}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
              >
                {exporting ? <Spinner size="sm" /> : <Download className="h-4 w-4 text-gray-500" />}
                <span>Exporter CSV</span>
              </button>
            </>
          )}

          <button
            onClick={fetchUsines}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 bg-white hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Rafraîchir
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div className="mb-4">
          <Alert
            type={bannerMsg.type}
            message={bannerMsg.text}
          />
        </div>
      )}

      {/* Légende */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-primary-600" /> Usine</span>
          <span className="flex items-center gap-1.5"><Layers    className="h-3.5 w-3.5 text-blue-600" />    Zone / Atelier</span>
          <span className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5 text-green-600" />   Ligne de production</span>
          <span className="flex items-center gap-1.5"><Wrench    className="h-3.5 w-3.5 text-orange-500" />  Machine</span>
          <span className="flex items-center gap-1.5"><Package   className="h-3.5 w-3.5 text-gray-400" />    Composant</span>
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={fetchUsines} className="text-sm text-primary-600 hover:underline">Réessayer</button>
        </div>
      ) : usines.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 shadow-sm">
          <Building2 className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">Aucune usine configurée</p>
          <p className="text-xs text-gray-400 mt-1">
            Créez d'abord une usine ou importez la hiérarchie complète via CSV.
          </p>
          {role === 'ADMIN' && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setIsImportOpen(true)}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
              >
                <Upload className="h-4 w-4" /> Importer CSV
              </button>
              <button
                onClick={() => navigate('/equipements/usines')}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Gérer les usines
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {usines.map(u => <UsineCard key={u.id} usine={u} navigate={navigate} />)}
        </div>
      )}

      {/* Import CSV Modal */}
      {isImportOpen && (
        <HierarchyCsvImportModal
          onClose={() => setIsImportOpen(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </Layout>
  )
}
