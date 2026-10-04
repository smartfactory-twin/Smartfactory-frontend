import AdminLayout from '../../components/layout/AdminLayout'
import { useAuthContext } from '../../context/AuthContext'
import { BarChart3, AlertTriangle, Users, Activity } from 'lucide-react'

const stats = [
  { label: 'Sites actifs',         value: '4',     sub: '100% en ligne',    icon: BarChart3,      color: 'bg-blue-50 text-blue-600' },
  { label: 'Santé des équipements',value: '87.6%', sub: '+2.4%',            icon: Activity,       color: 'bg-green-50 text-green-600' },
  { label: 'Alertes critiques',    value: '9',     sub: '−3 cette semaine', icon: AlertTriangle,  color: 'bg-red-50 text-red-500' },
  { label: 'Utilisateurs actifs',  value: '—',     sub: 'Gérer →',          icon: Users,          color: 'bg-purple-50 text-purple-600' },
]

export default function DashboardPage() {
  const { user } = useAuthContext()
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <AdminLayout>
      {/* En-tête */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 mb-1">
          {dateStr.toUpperCase()}
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          Bonjour, {user?.prenom}
        </h1>
        <p className="mt-1 text-gray-500">Voici l'état opérationnel de vos sites industriels.</p>
      </div>

      {/* Cards stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="mt-1 text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Placeholder modules futurs */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm text-center text-gray-400">
        <p className="text-sm">Les graphiques et modules supplémentaires seront ajoutés à la prochaine étape.</p>
      </div>
    </AdminLayout>
  )
}
