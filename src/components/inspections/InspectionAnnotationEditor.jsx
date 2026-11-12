import { useEffect, useRef, useState } from 'react'
import { ArrowDownRight, Circle, MessageSquareText, RectangleHorizontal, Save, Undo2, X } from 'lucide-react'

const TOOLS = [
  { id: 'rectangle', label: 'Rectangle', icon: RectangleHorizontal },
  { id: 'circle', label: 'Cercle', icon: Circle },
  { id: 'arrow', label: 'Flèche', icon: ArrowDownRight },
  { id: 'comment', label: 'Commentaire', icon: MessageSquareText },
]

function paintShape(context, shape, scale) {
  const { x, y, x2 = x, y2 = y } = shape
  context.save()
  context.strokeStyle = '#ff5252'
  context.fillStyle = '#ff5252'
  context.lineWidth = Math.max(3, scale * .004)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  if (shape.type === 'rectangle') context.strokeRect(x, y, x2 - x, y2 - y)
  if (shape.type === 'circle') {
    const radiusX = Math.abs(x2 - x) / 2
    const radiusY = Math.abs(y2 - y) / 2
    context.beginPath()
    context.ellipse(x + (x2 - x) / 2, y + (y2 - y) / 2, Math.max(radiusX, 2), Math.max(radiusY, 2), 0, 0, Math.PI * 2)
    context.stroke()
  }
  if (shape.type === 'arrow') {
    const angle = Math.atan2(y2 - y, x2 - x)
    const head = Math.max(12, scale * .025)
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x2, y2)
    context.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6))
    context.moveTo(x2, y2)
    context.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6))
    context.stroke()
  }
  if (shape.type === 'comment') {
    const fontSize = Math.max(15, scale * .024)
    context.font = `600 ${fontSize}px sans-serif`
    const width = context.measureText(shape.text || '').width + 16
    context.fillStyle = 'rgba(7, 12, 16, .82)'
    context.fillRect(x, y - fontSize - 9, width, fontSize + 12)
    context.fillStyle = '#fff'
    context.fillText(shape.text || '', x + 8, y - 7)
  }
  context.restore()
}

export default function InspectionAnnotationEditor({ inspection, onClose, onSave }) {
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const pointerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [tool, setTool] = useState('rectangle')
  const [shapes, setShapes] = useState(inspection.annotations || [])
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!active || !canvasRef.current) return
      imageRef.current = image
      canvasRef.current.width = image.naturalWidth
      canvasRef.current.height = image.naturalHeight
      setReady(true)
    }
    image.onerror = () => setError('Impossible de charger l’image d’origine pour l’annotation.')
    image.src = inspection.image
    return () => { active = false }
  }, [inspection.image])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!ready || !canvas || !context || !imageRef.current) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(imageRef.current, 0, 0)
    ;[...shapes, ...(draft ? [draft] : [])].forEach((shape) => paintShape(context, shape, canvas.width))
  }, [ready, shapes, draft])

  const position = (event) => {
    const canvas = canvasRef.current
    const box = canvas.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - box.left) * canvas.width / box.width)),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - box.top) * canvas.height / box.height)),
    }
  }

  const start = (event) => {
    if (!ready) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = position(event)
    pointerRef.current = point
    setDraft({ type: tool, ...point, x2: point.x, y2: point.y, text: '' })
  }

  const move = (event) => {
    if (!pointerRef.current || !draft) return
    const point = position(event)
    setDraft((current) => current ? { ...current, x2: point.x, y2: point.y } : null)
  }

  const finish = () => {
    if (!pointerRef.current || !draft) return
    pointerRef.current = null
    if (draft.type === 'comment') {
      const text = window.prompt('Texte du commentaire sur la photo :', '')?.trim()
      if (text) setShapes((current) => [...current, { ...draft, x2: draft.x, y2: draft.y, text: text.slice(0, 500) }])
    } else {
      setShapes((current) => [...current, draft])
    }
    setDraft(null)
  }

  const save = async () => {
    const canvas = canvasRef.current
    if (!canvas || !ready) return
    setSaving(true)
    setError('')
    try {
      const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Export image impossible.')), 'image/png'))
      await onSave(new File([blob], `inspection-${inspection.id}-annotee.png`, { type: 'image/png' }), shapes)
    } catch (saveError) {
      setError(saveError?.message || 'Impossible d’enregistrer les annotations.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="sf-inspection-modal-backdrop" role="presentation" onClick={onClose}>
    <section className="sf-inspection-annotation-modal" role="dialog" aria-modal="true" aria-labelledby="annotation-title" onClick={(event) => event.stopPropagation()}>
      <header><div><h2 id="annotation-title">Annoter la photo · {inspection.machine_nom}</h2><p>Rectangle, cercle, flèche et commentaires sont enregistrés avec l’image.</p></div><button type="button" onClick={onClose} aria-label="Fermer"><X /></button></header>
      <div className="sf-annotation-toolbar" role="toolbar" aria-label="Outils d’annotation">{TOOLS.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={tool === id ? 'is-active' : ''} onClick={() => setTool(id)} aria-pressed={tool === id}><Icon />{label}</button>)}<button type="button" onClick={() => setShapes((current) => current.slice(0, -1))} disabled={!shapes.length}><Undo2 />Annuler</button></div>
      <div className="sf-annotation-canvas-wrap">{!ready && !error && <p>Chargement de la photo…</p>}<canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { pointerRef.current = null; setDraft(null) }} aria-label="Zone de dessin des annotations" />{error && <p className="sf-inspection-error">{error}</p>}</div>
      <footer><span>{shapes.length} annotation{shapes.length === 1 ? '' : 's'}</span><button type="button" className="sf-inspection-primary" onClick={save} disabled={!ready || saving}><Save />{saving ? 'Enregistrement…' : 'Enregistrer les annotations'}</button></footer>
    </section>
  </div>
}
