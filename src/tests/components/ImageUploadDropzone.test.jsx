import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ImageUploadDropzone from '../../components/inspections/ImageUploadDropzone'

function renderDropzone(props = {}) {
  const onFiles = vi.fn()
  const onRemove = vi.fn()
  const utils = render(<ImageUploadDropzone onFiles={onFiles} onRemove={onRemove} {...props} />)
  return { onFiles, onRemove, ...utils }
}

const fileInput = (container) => container.querySelector('input[type="file"]')

describe('ImageUploadDropzone', () => {
  it('accepte une image PNG valide', () => {
    const { container, onFiles } = renderDropzone()
    const file = new File([new Uint8Array(1024)], 'photo.png', { type: 'image/png' })

    fireEvent.change(fileInput(container), { target: { files: [file] } })

    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it('rejette un fichier dont le format n’est pas une image', () => {
    const { container, onFiles } = renderDropzone()
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    fireEvent.change(fileInput(container), { target: { files: [file] } })

    expect(onFiles).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/formats acceptés : JPG, PNG et WEBP/i)
  })

  it('rejette une image trop volumineuse', () => {
    const { container, onFiles } = renderDropzone({ maxMb: 1 })
    const file = new File([new Uint8Array(2 * 1024 * 1024)], 'big.png', { type: 'image/png' })

    fireEvent.change(fileInput(container), { target: { files: [file] } })

    expect(onFiles).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/big\.png dépasse 1 Mo/i)
  })

  it('affiche l’aperçu, le nom et la taille des fichiers fournis', () => {
    const file = new File([new Uint8Array(2048)], 'inspection.png', { type: 'image/png' })
    const { container } = renderDropzone({ files: [file] })

    expect(screen.getByText('inspection.png')).toBeInTheDocument()
    expect(screen.getByText(/2\.0 Ko/)).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:preview')
  })

  it('retire le fichier sélectionné', () => {
    const file = new File([new Uint8Array(16)], 'inspection.png', { type: 'image/png' })
    const { onRemove } = renderDropzone({ files: [file] })

    fireEvent.click(screen.getByRole('button', { name: 'Retirer inspection.png' }))

    expect(onRemove).toHaveBeenCalledWith(0)
  })

  it('accepte une image déposée par glisser-déposer', () => {
    const { onFiles } = renderDropzone()
    const file = new File([new Uint8Array(512)], 'drop.png', { type: 'image/png' })

    fireEvent.drop(screen.getByTestId('inspection-dropzone'), {
      dataTransfer: { files: [file] },
    })

    expect(onFiles).toHaveBeenCalledWith([file])
  })
})
