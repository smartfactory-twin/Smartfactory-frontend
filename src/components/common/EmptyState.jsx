/**
 * État vide générique — affiché quand aucune donnée n'est disponible
 * (backend non encore implémenté ou liste vide réelle).
 */
export default function EmptyState({ icon: Icon, title, description, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {Icon && (
        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-gray-400" />
        </div>
      )}
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-gray-400 max-w-xs">{description}</p>
      )}
    </div>
  )
}
