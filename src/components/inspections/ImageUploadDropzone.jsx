import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, UploadCloud, X } from 'lucide-react'

const ACCEPTED_EXT = /\.(jpe?g|png|webp)$/i
const EMPTY_FILES = Object.freeze([])

export function formatFileSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
}

export default function ImageUploadDropzone({
  files = EMPTY_FILES, onFiles, onRemove, machineLabel, technicianName,
  disabled = false, maxFiles = 10, maxMb = 20,
}) {
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [previews, setPreviews] = useState([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setPreviews(next)
    return () => next.forEach(({ url }) => URL.revokeObjectURL(url))
  }, [files])

  useEffect(() => {
    if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current
  }, [cameraOpen])

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  const acceptFiles = (candidates) => {
    const incoming = Array.from(candidates || [])
    if (!incoming.length) return
    if (files.length + incoming.length > maxFiles) {
      setLocalError(`Vous pouvez sélectionner ${maxFiles} fichiers maximum.`)
      return
    }
    const rejected = incoming.find((candidate) => {
      const valid = ACCEPTED_EXT.test(candidate.name) && (
        !candidate.type || ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(candidate.type)
      )
      return !valid || candidate.size > maxMb * 1024 * 1024
    })
    if (rejected) {
      setLocalError(ACCEPTED_EXT.test(rejected.name)
        ? `${rejected.name} dépasse ${maxMb} Mo ou son type MIME n'est pas accepté.`
        : 'Formats acceptés : JPG, PNG et WEBP.')
      return
    }
    setLocalError(null)
    onFiles?.(incoming)
    if (inputRef.current) inputRef.current.value = ''
  }

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  const openCamera = async () => {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('La caméra n’est pas disponible dans ce navigateur ou cette connexion.')
      return
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      setCameraOpen(true)
    } catch {
      setCameraError('Autorisez l’accès à la caméra dans le navigateur pour prendre une photo.')
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const stamp = `${machineLabel || 'Machine'}  ·  ${technicianName || 'Technicien'}  ·  ${new Date().toLocaleString('fr-FR')}`
    const bandHeight = Math.max(46, Math.round(canvas.width * .055))
    context.fillStyle = 'rgba(7, 12, 16, .78)'
    context.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight)
    context.fillStyle = '#ffffff'
    context.font = `600 ${Math.max(14, Math.round(canvas.width * .019))}px sans-serif`
    context.fillText(stamp.slice(0, 150), Math.round(canvas.width * .025), canvas.height - Math.round(bandHeight * .38), canvas.width * .95)
    canvas.toBlob((blob) => {
      if (!blob) return
      const candidate = new File([blob], `inspection-${Date.now()}.jpg`, { type: 'image/jpeg' })
      if (files.length >= maxFiles) {
        setLocalError(`La limite de ${maxFiles} fichiers est atteinte.`)
        return
      }
      onFiles?.([candidate])
      closeCamera()
    }, 'image/jpeg', .92)
  }

  return (
    <section className="sf-inspection-upload">
      <div className="sf-inspection-upload-heading"><div><b>Photos à inspecter</b><small>Une série peut contenir jusqu’à {maxFiles} photos · {maxMb} Mo par photo</small></div>
        <div className="sf-inspection-upload-actions"><button type="button" onClick={cameraOpen ? closeCamera : openCamera} disabled={disabled}><Camera />{cameraOpen ? 'Fermer la caméra' : 'Prendre une photo'}</button></div>
      </div>
      {localError && <p role="alert" className="sf-inspection-error">{localError}</p>}
      {cameraError && <p role="alert" className="sf-inspection-error">{cameraError}</p>}
      {cameraOpen && <div className="sf-camera-panel"><video ref={videoRef} autoPlay playsInline muted /><div><span>Étiquette intégrée : {machineLabel || 'machine'} · {technicianName || 'technicien'} · date et heure</span><button type="button" onClick={capture}>Capturer</button></div></div>}
      <div onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) acceptFiles(event.dataTransfer?.files) }} onClick={() => !disabled && inputRef.current?.click()} className={`sf-inspection-dropzone${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`} data-testid="inspection-dropzone">
        <UploadCloud aria-hidden="true" /><b>Glissez-déposez vos photos</b><span>ou cliquez pour parcourir · JPG, PNG, WEBP</span>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple className="hidden" data-testid="inspection-file-input" onChange={(event) => acceptFiles(event.target.files)} disabled={disabled} />
      {!!files.length && <div className="sf-inspection-file-grid">{files.map((file, index) => <article className="sf-inspection-file" key={`${file.name}-${file.lastModified}-${index}`}>
        <div className="sf-inspection-file-preview"><img src={previews[index]?.url} alt="" /></div><div><b title={file.name}>{file.name}</b><small>Photo · {formatFileSize(file.size)}</small></div><button type="button" aria-label={`Retirer ${file.name}`} onClick={() => onRemove?.(index)} disabled={disabled}><X /></button>
      </article>)}</div>}
      <p className="sf-inspection-meta-note"><ImageIcon aria-hidden="true" /> Les photos prises dans l’application portent automatiquement l’identifiant machine, le technicien et l’horodatage.</p>
    </section>
  )
}
