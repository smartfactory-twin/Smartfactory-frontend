export default function KpiCard({ icon: Icon, label, value, sub, iconBg, loading = false }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconBg ?? 'bg-gray-100'}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-16 bg-gray-100 animate-pulse rounded" />
      ) : (
        <p className="text-3xl font-bold text-gray-900">{value ?? '—'}</p>
      )}
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}
