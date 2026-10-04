import { useRef, useState } from 'react'
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react'

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
const ACCEPTED_EXT = /\.(jpe?g|png)$/i

export function formatFileSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
}

/**
 * Zone d'import d'une image (sélecteur de fichier + glisser-déposer).
 * Valide le format (JPG/JPEG/PNG) et la taille (maxMb) côté client.
 */
export default function ImageUploadDropzone({
  file,
  preview,
  onFile,
  onClear,
  disabled = false,
  maxMb = 5,
}) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState(null)

  const accept = (candidate) => {
    if (!candidate) return
    const validType = ACCEPTED_TYPES.includes(candidate.type) ||
      (!candidate.type && ACCEPTED_EXT.test(candidate.name))
    if (!validType) {
      setLocalError('Format non supporté. Utilisez une image JPG, JPEG ou PNG.')
      return
    }
    if (maxMb && candidate.size > maxMb * 1024 * 1024) {
      setLocalError(`L'image ne doit pas dépasser ${maxMb} Mo.`)
      return
    }
    setLocalError(null)
    onFile(candidate)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    accept(e.dataTransfer?.files?.[0])
  }

  const handleClear = () => {
    setLocalError(null)
    if (inputRef.current) inputRef.current.value = ''
    onClear()
  }

  return (
    <div className="space-y-3">
      <p className="block text-sm font-medium text-gray-700">
        Image à inspecter <span className="text-red-500">*</span>
      </p>

      {localError && (
        <p role="alert" className="text-sm text-red-600">{localError}</p>
      )}

      {file && preview ? (
        <div className="flex flex-col sm:flex-row gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <img
            src={preview}
            alt={file.name}
            className="h-32 w-32 rounded-lg object-cover border border-gray-200 bg-white"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
            <p className="text-xs text-gray-500 mt-1">{formatFileSize(file.size)}</p>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Retirer l'image
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors
            ${dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white'}
            ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-primary-400'}`}
          onClick={() => !disabled && inputRef.current?.click()}
          data-testid="inspection-dropzone"
        >
          <UploadCloud className="h-10 w-10 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">
            Glissez-déposez une image ici
          </p>
          <p className="text-xs text-gray-500">
            ou cliquez pour parcourir (JPG, JPEG, PNG — max {maxMb} Mo)
          </p>
          <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600">
            <ImageIcon className="h-3.5 w-3.5" /> Importer une image
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
        className="hidden"
        data-testid="inspection-file-input"
        onChange={(e) => accept(e.target.files?.[0])}
        disabled={disabled}
      />
    </div>
  )
}
