import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MachineDetailPage from '../../pages/machines/MachineDetailPage'
import { AuthContext } from '../../context/AuthContext'
import * as machineService from '../../services/machineService'
import * as equipementService from '../../services/equipementService'

vi.mock('../../services/machineService', () => ({
  getMachine: vi.fn(),
  deleteMachine: vi.fn(),
}))
vi.mock('../../services/equipementService', () => ({
  addMachineComposant: vi.fn(),
  updateComposant: vi.fn(),
  deleteComposant: vi.fn(),
}))

const MACHINE = {
  id: 1,
  nom: 'Tour CNC',
  identifiant_interne: 'TC-004',
  statut: 'NORMAL',
  numero_serie: 'SN-2024-001',
  marque: 'Siemens',
  modele: 'X200',
  date_installation: '2024-01-15',
  description: 'Machine de test',
  position_sur_plan: 'Zone B',
  usine_nom: 'Usine A',
  zone_nom: 'Zone 1',
  ligne_production_nom: 'Ligne A',
  photo: 'http://localhost:8000/media/machines/photos/tour.png',
  documents: [],
  composants: [],
}

function renderDetail(role = 'ADMIN') {
  const ctxValue = {
    user: { id: 1, email: 'admin@smartfactory.dz', role },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter initialEntries={['/machines/1']}>
        <Routes>
          <Route path="/machines/:id" element={<MachineDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('MachineDetailPage — photo cliquable (agrandissement)', () => {
  beforeEach(() => {
    machineService.getMachine.mockResolvedValue(MACHINE)
    equipementService.addMachineComposant.mockResolvedValue({})
    equipementService.updateComposant.mockResolvedValue({})
    equipementService.deleteComposant.mockResolvedValue({})
  })

  it('affiche la photo de la machine', async () => {
    renderDetail()

    const img = await screen.findByAltText('Tour CNC')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', MACHINE.photo)
  })

  it('ouvre la visionneuse au clic sur la photo et la referme avec Échap', async () => {
    renderDetail()

    const thumbnail = await screen.findByAltText('Tour CNC')
    expect(screen.queryByTestId('image-lightbox')).not.toBeInTheDocument()

    await userEvent.click(thumbnail)

    expect(screen.getByTestId('image-lightbox')).toBeInTheDocument()
    // La vignette et l'image agrandie pointent vers la même source
    expect(screen.getAllByAltText('Tour CNC')).toHaveLength(2)

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('image-lightbox')).not.toBeInTheDocument()
  })

  it('peut fermer la visionneuse avec le bouton de fermeture', async () => {
    renderDetail()

    await userEvent.click(await screen.findByAltText('Tour CNC'))
    expect(screen.getByTestId('image-lightbox')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Fermer'))
    expect(screen.queryByTestId('image-lightbox')).not.toBeInTheDocument()
  })

  it("affiche un placeholder quand la machine n'a pas de photo", async () => {
    machineService.getMachine.mockResolvedValue({ ...MACHINE, photo: null })
    renderDetail()

    expect(await screen.findByText('Aucune photo')).toBeInTheDocument()
    expect(screen.queryByAltText('Tour CNC')).not.toBeInTheDocument()
  })
})
