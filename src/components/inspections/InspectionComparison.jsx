import { ArrowLeftRight } from 'lucide-react'
import { formatDate } from './InspectionResultCard'

function ImageChoice({ label, inspections, value, onChange }) {
  return <label className="sf-inspection-compare-choice"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">Choisir une inspection</option>
    {inspections.filter((inspection) => inspection.media_type !== 'VIDEO' && inspection.image).map((inspection) => <option key={inspection.id} value={inspection.id}>
      {formatDate(inspection.date_inspection)} · {inspection.machine_nom} · #{inspection.id}
    </option>)}
  </select></label>
}

export default function InspectionComparison({ inspections, beforeId, afterId, onBeforeChange, onAfterChange }) {
  const before = inspections.find((item) => String(item.id) === String(beforeId))
  const after = inspections.find((item) => String(item.id) === String(afterId))
  const machineId = before?.machine ?? after?.machine
  const comparableInspections = machineId
    ? inspections.filter((item) => String(item.machine) === String(machineId))
    : inspections
  return <section className="sf-inspection-comparison">
    <header><div><h3>Comparaison avant / après</h3><p>Choisissez deux photos d’inspection d’une même machine.</p></div><ArrowLeftRight aria-hidden="true" /></header>
    <div className="sf-inspection-compare-controls">
      <ImageChoice label="Avant" inspections={comparableInspections} value={beforeId} onChange={onBeforeChange} />
      <ImageChoice label="Après" inspections={comparableInspections} value={afterId} onChange={onAfterChange} />
    </div>
    <div className="sf-inspection-compare-grid">{[[before, 'Avant'], [after, 'Après']].map(([inspection, label]) => <article key={label}>
      <header><b>{label}</b>{inspection && <span>{inspection.machine_nom} · {formatDate(inspection.date_inspection)}</span>}</header>
      {inspection ? <img src={label === 'Après' && inspection.image_annotee ? inspection.image_annotee : inspection.image} alt={`${label} inspection ${inspection.id}`} /> : <div className="sf-inspection-compare-empty">Sélectionnez une photo</div>}
    </article>)}</div>
  </section>
}
