import { MachineStatusBadge } from '../common/StatusBadge'

function Info({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 truncate">{value || '—'}</p>
    </div>
  )
}

/**
 * Sélection d'une machine à inspecter + rappel de ses informations
 * (nom, identifiant interne, ligne, statut).
 */
export default function MachineSelector({ machines = [], value, onChange, disabled = false }) {
  const selected = machines.find((m) => String(m.id) === String(value))

  return (
    <div className="space-y-3">
      <label htmlFor="inspection-machine" className="block text-sm font-medium text-gray-700">
        Machine à inspecter <span className="text-red-500">*</span>
      </label>
      <select
        id="inspection-machine"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input-field w-full"
      >
        <option value="">— Sélectionner une machine —</option>
        {machines.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nom} ({m.identifiant_interne})
          </option>
        ))}
      </select>

      {selected && (
        <div
          data-testid="selected-machine-info"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <Info label="Machine" value={selected.nom} />
          <Info label="Identifiant interne" value={selected.identifiant_interne} />
          <Info label="Ligne" value={selected.ligne_production_nom} />
          <div>
            <p className="text-xs text-gray-500 mb-1">Statut</p>
            <MachineStatusBadge status={selected.statut} />
          </div>
        </div>
      )}

      {!selected && value && machines.length > 0 && (
        <p className="text-sm text-amber-600">
          La machine sélectionnée n'est pas disponible dans la liste.
        </p>
      )}
    </div>
  )
}
