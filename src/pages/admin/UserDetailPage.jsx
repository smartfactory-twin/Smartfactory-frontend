import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, UserRound } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import Alert from '../../components/common/Alert'
import { listUsers, getUserActivityHistory } from '../../services/authService'
import ScopeManager from '../../components/users/ScopeManager'

const ROLE_LABELS = { ADMIN: 'Administrateur', TECHNICIEN: 'Technicien', OPERATEUR: 'Opérateur' }

function actionLabel(event) {
  if (event.action_label) return event.action_label
  const path = event.chemin || ''
  if (path.includes('/acquitter/')) return 'Acquittement d’une alerte'
  if (path.includes('/logout/')) return 'Déconnexion'
  if (path.includes('/capteurs/preview_csv/')) return 'Prévisualisation d’un import de capteurs'
  if (path.includes('/readings/')) return 'Import ou consultation de mesures'
  if (path.includes('/alertes/')) return 'Consultation ou traitement d’une alerte'
  if (path.includes('/machines/')) return 'Action sur une machine'
  if (path.includes('/users/')) return 'Gestion d’un utilisateur'
  if (path.includes('/voice/')) return 'Utilisation de l’assistant vocal'
  return 'Action dans l’application'
}

function outcomeLabel(code) {
  if (code >= 200 && code < 300) return 'Réussi'
  if (code === 403) return 'Accès refusé'
  if (code >= 400 && code < 500) return 'Action refusée'
  if (code >= 500) return 'Erreur du serveur'
  return 'Enregistré'
}

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [events, setEvents] = useState([])
  const [eventCount, setEventCount] = useState(0)
  const [historyTruncated, setHistoryTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([listUsers({ page_size: 200 }), getUserActivityHistory(id)])
      .then(([usersData, auditData]) => {
        if (!active) return
        const users = usersData.results ?? usersData
        setUser(users.find((item) => String(item.id) === String(id)) ?? null)
        setEvents(auditData.results ?? [])
        setEventCount(auditData.count ?? auditData.results?.length ?? 0)
        setHistoryTruncated(Boolean(auditData.truncated))
      })
      .catch(() => { if (active) setError('Impossible de charger les informations et l’historique de cet utilisateur.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  return <AdminLayout pageTitle="Détail utilisateur">
    <main className="space-y-5">
      <button type="button" onClick={() => navigate('/admin/users')} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" />Retour à la liste</button>
      {error && <Alert type="error" message={error} />}
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : user ? <>
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-primary-100 text-primary-700"><UserRound /></span><div><h1 className="text-xl font-bold text-gray-900">{user.prenom} {user.nom}</h1><p className="text-sm text-gray-500">{user.email}</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{ROLE_LABELS[user.role] || user.role}</span><span className={`rounded-full px-3 py-1 ${user.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{user.actif ? 'Actif' : 'Inactif'}</span><span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">{eventCount} actions enregistrées</span></div>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900">Affectations et périmètre d’accès</h2>
          <p className="mb-4 mt-1 text-sm text-gray-500">Usines, zones, lignes et machines accessibles à cet utilisateur.</p>
          {user.role === 'ADMIN' ? <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-800">L’administrateur dispose d’un accès global.</p> : <ScopeManager utilisateurId={user.id} readOnly />}
        </section>
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <header className="border-b border-gray-100 px-5 py-4"><h2 className="font-semibold text-gray-900">Historique des actions</h2><p className="mt-1 text-sm text-gray-500">Les acquittements et les ordres de travail apparaissent avec les autres actions de cet utilisateur.</p></header>
          {historyTruncated && <p className="border-b border-gray-100 bg-amber-50 px-5 py-2 text-xs text-amber-800">Affichage des 200 actions les plus récentes.</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Détails</th><th className="px-4 py-3">Résultat</th></tr></thead><tbody className="divide-y divide-gray-100">{events.length ? events.map((event) => <tr key={event.id}><td className="whitespace-nowrap px-4 py-3">{new Date(event.cree_le).toLocaleString('fr-FR')}</td><td className="px-4 py-3 font-medium">{actionLabel(event)}</td><td className="px-4 py-3 text-gray-600">{event.description || '—'}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs ${event.code_http >= 200 && event.code_http < 300 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{outcomeLabel(event.code_http)}</span></td></tr>) : <tr><td colSpan="4" className="px-4 py-12 text-center text-gray-500">Aucune action enregistrée pour cet utilisateur.</td></tr>}</tbody></table></div>
        </section>
      </> : !error && <p className="py-10 text-center text-gray-500">Utilisateur introuvable.</p>}
    </main>
  </AdminLayout>
}
