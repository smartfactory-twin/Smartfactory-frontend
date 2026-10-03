import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ImageUploadDropzone from '../../components/inspections/ImageUploadDropzone'

function renderDropzone(props = {}) {
  const onFile = vi.fn()
  const onClear = vi.fn()
  const utils = render(
    <ImageUploadDropzone
      file={null}
      preview={null}
      onFile={onFile}
      onClear={onClear}
      {...props}
    />
  )
  return { onFile, onClear, ...utils }
}

const fileInput = (container) => container.querySelector('input[type="file"]')

describe('ImageUploadDropzone — Module 4', () => {
  it('accepte une image PNG valide', () => {
    const { container, onFile } = renderDropzone()
    const file = new File([new Uint8Array(1024)], 'photo.png', { type: 'image/png' })

    fireEvent.change(fileInput(container), { target: { files: [file] } })

    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('rejette un fichier dont le format n\'est pas une image', () => {
    const { container, onFile } = renderDropzone()
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    fireEvent.change(fileInput(container), { target: { files: [file] } })

    expect(onFile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/format non supporté/i)
  })

  it('rejette une image trop volumineuse', () => {
    const { container, onFile } = renderDropzone({ maxMb: 1 })
    const file = new File([new Uint8Array(2 * 1024 * 1024)], 'big.png', { type: 'image/png' })

    fireEvent.change(fileInput(container), { target: { files: [file] } })

    expect(onFile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/ne doit pas dépasser 1 mo/i)
  })

  it('affiche l\'aperçu (nom + taille) lorsque le fichier est fourni', () => {
    const file = new File([new Uint8Array(2048)], 'inspection.png', { type: 'image/png' })
    renderDropzone({ file, preview: 'blob:preview' })

    expect(screen.getByText('inspection.png')).toBeInTheDocument()
    expect(screen.getByText('2.0 Ko')).toBeInTheDocument()
    expect(screen.getByAltText('inspection.png')).toHaveAttribute('src', 'blob:preview')
  })

  it('retire l\'image sélectionnée', () => {
    const file = new File([new Uint8Array(16)], 'inspection.png', { type: 'image/png' })
    const { onClear } = renderDropzone({ file, preview: 'blob:preview' })

    fireEvent.click(screen.getByRole('button', { name: /retirer l'image/i }))

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('accepte une image déposée (glisser-déposer)', () => {
    const { onFile } = renderDropzone()
    const file = new File([new Uint8Array(512)], 'drop.png', { type: 'image/png' })

    fireEvent.drop(screen.getByTestId('inspection-dropzone'), {
      dataTransfer: { files: [file] },
    })

    expect(onFile).toHaveBeenCalledWith(file)
  })
})
