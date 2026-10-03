import { useAuthContext } from '../context/AuthContext'
import Button from '../components/common/Button'

export default function PlaceholderPage({ title = 'Page en cours de développement', role }) {
  const { user, logout } = useAuthContext()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-full bg-primary-50 flex items-center justify-center">
            <span className="text-2xl">🏭</span>
          </div>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        {role && (
          <span className="inline-block px-3 py-1 text-xs font-semibold bg-primary-50 text-primary-700 rounded-full mb-4">
            {role}
          </span>
        )}
        <p className="text-gray-500 text-sm mb-6">
          Connecté en tant que <strong>{user?.prenom} {user?.nom}</strong> ({user?.email})
        </p>
        <p className="text-xs text-gray-400 mb-8">
          Cette page sera implémentée à la prochaine étape.
        </p>
        <Button variant="secondary" onClick={logout} className="w-full">
          Se déconnecter
        </Button>
      </div>
    </div>
  )
}
