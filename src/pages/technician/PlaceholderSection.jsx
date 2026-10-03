import TechnicianLayout from '../../components/layout/TechnicianLayout'
import EmptyState from '../../components/common/EmptyState'
import { Construction } from 'lucide-react'

export default function TechnicianSection({ title, description }) {
  return (
    <TechnicianLayout pageTitle={title}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <EmptyState
          icon={Construction}
          title="Module en cours de développement"
          description="Ce module sera disponible après le déploiement du backend correspondant (Sprint 2+). L'interface est prête à recevoir les données."
          className="py-20"
        />
      </div>
    </TechnicianLayout>
  )
}
