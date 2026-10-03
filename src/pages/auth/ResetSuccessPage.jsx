import { Link } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import Button from '../../components/common/Button'

export default function ResetSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mot de passe réinitialisé !</h1>
        <p className="text-gray-500 mb-8">
          Votre mot de passe a été changé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
        </p>
        <Link to="/login">
          <Button className="w-full" size="lg">Se connecter</Button>
        </Link>
      </div>
    </div>
  )
}
