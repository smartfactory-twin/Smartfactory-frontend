import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import InspectionsPage from '../../pages/inspections/InspectionsPage'
import { AuthContext } from '../../context/AuthContext'
import * as inspectionService from '../../services/inspectionService'
import * as machineService from '../../services/machineService'

vi.mock('../../services/inspectionService', () => ({
  getInspections: vi.fn(),
  createInspection: vi.fn(),
  analyzeInspection: vi.fn(),
  deleteInspection: vi.fn(),
}))
vi.mock('../../services/machineService', () => ({
  getMachines: vi.fn(),
}))

const MACHINES = [
  {
    id: 1, nom: 'Tour CNC', identifiant_interne: 'TC-004',
    statut: 'NORMAL', ligne_production_nom: 'Ligne A',
  },
  {
    id: 2, nom: 'Presse hydraulique', identifiant_interne: 'PH-001',
    statut: 'DEGRADE', ligne_production_nom: 'Ligne B',
  },
]

const HISTORY = [
  {
    id: 1, machine: 1, machine_nom: 'Tour CNC', machine_identifiant: 'TC-004',
    utilisateur_nom: 'Admin Test', date_inspection: '2026-10-02T09:00:00Z',
    statut_analyse: 'TERMINEE', score_confiance: 0.88,
    image: 'http://localhost/media/inspections/images/1.png',
    resultat_analyse: {
      defect_detected: false, defect_type: null, confidence: 0.88,
      localization: null, comment: 'État conforme.',
    },
  },
  {
    id: 2, machine: 2, machine_nom: 'Presse hydraulique', machine_identifiant: 'PH-001',
    utilisateur_nom: 'Tech Test', date_inspection: '2026-10-01T08:00:00Z',
    statut_analyse: 'EN_ATTENTE', score_confiance: null,
    image: null, resultat_analyse: null,
  },
]

const ANALYZED = {
  id: 42, machine: 1, machine_nom: 'Tour CNC', machine_identifiant: 'TC-004',
  utilisateur_nom: 'Admin Test', date_inspection: '2026-10-03T10:00:00Z',
  statut_analyse: 'TERMINEE', score_confiance: 0.91,
  image: 'http://localhost/media/inspections/images/42.png',
  resultat_analyse: {
    defect_detected: true, defect_type: 'Fissure', confidence: 0.91,
    localization: 'centre', comment: 'Fissure détectée sur la zone centre.',
  },
}

function renderPage(role = 'ADMIN') {
  const ctxValue = {
    user: { id: 1, email: 'admin@smartfactory.dz', role, prenom: 'Admin', nom: 'Test' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter>
        <InspectionsPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

function uploadImage(container, file = new File([new Uint8Array(2048)], 'photo.png', { type: 'image/png' })) {
  const input = container.querySelector('input[type="file"]')
  return userEvent.upload(input, file)
}

describe('InspectionsPage — Module 4 (UC-10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    machineService.getMachines.mockResolvedValue({ count: MACHINES.length, results: MACHINES })
    inspectionService.getInspections.mockResolvedValue({ count: HISTORY.length, results: HISTORY })
  })

  it('affiche le titre, la sélection de machine et l\'historique', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: /inspection visuelle par ia/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/machine à inspecter/i)).toBeInTheDocument()
    expect(screen.getByTestId('inspection-dropzone')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analyser avec l'ia/i })).toBeInTheDocument()

    expect(await screen.findByText('Tech Test')).toBeInTheDocument()
    expect(screen.getByText('Tech Test')).toBeInTheDocument()
    expect(screen.getAllByText('Tour CNC').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Terminée').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('En attente').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('88 %').length).toBeGreaterThanOrEqual(1)
  })

  it('affiche les informations de la machine sélectionnée', async () => {
    renderPage()
    await screen.findByText('Tech Test')

    await userEvent.selectOptions(screen.getByLabelText(/machine à inspecter/i), '1')

    const info = screen.getByTestId('selected-machine-info')
    expect(within(info).getByText('Tour CNC')).toBeInTheDocument()
    expect(within(info).getByText('TC-004')).toBeInTheDocument()
    expect(within(info).getByText('Ligne A')).toBeInTheDocument()
    expect(within(info).getByText('Normal')).toBeInTheDocument()
  })

  it('importe une image et affiche son aperçu (nom + taille)', async () => {
    const { container } = renderPage()
    await screen.findByText('Tech Test')

    await uploadImage(container)

    expect(screen.getByText('photo.png')).toBeInTheDocument()
    expect(screen.getByText('2.0 Ko')).toBeInTheDocument()
    expect(screen.getByAltText('photo.png')).toBeInTheDocument()
  })

  it('lance l\'analyse IA et affiche le résultat', async () => {
    inspectionService.createInspection.mockResolvedValue({ id: 42 })
    inspectionService.analyzeInspection.mockResolvedValue(ANALYZED)

    const { container } = renderPage()
    await screen.findByText('Tech Test')

    await userEvent.selectOptions(screen.getByLabelText(/machine à inspecter/i), '1')
    await uploadImage(container)
    await userEvent.click(screen.getByRole('button', { name: /analyser avec l'ia/i }))

    await waitFor(() => {
      expect(inspectionService.createInspection).toHaveBeenCalledTimes(1)
      expect(inspectionService.analyzeInspection).toHaveBeenCalledWith(42)
    })

    expect(await screen.findByTestId('inspection-result-card')).toBeInTheDocument()
    expect(screen.getByText('Résultat de l\'analyse')).toBeInTheDocument()
    expect(screen.getByText('Fissure')).toBeInTheDocument()
    expect(screen.getByText('Oui')).toBeInTheDocument()
    expect(screen.getByText('91 %')).toBeInTheDocument()
    expect(screen.getByText(/fissure détectée sur la zone centre/i)).toBeInTheDocument()
  })

  it('affiche l\'état « Analyse en cours... » pendant le traitement', async () => {
    inspectionService.createInspection.mockResolvedValue({ id: 42 })
    let resolveAnalyze
    inspectionService.analyzeInspection.mockReturnValue(
      new Promise((resolve) => { resolveAnalyze = resolve })
    )

    const { container } = renderPage()
    await screen.findByText('Tech Test')

    await userEvent.selectOptions(screen.getByLabelText(/machine à inspecter/i), '1')
    await uploadImage(container)
    await userEvent.click(screen.getByRole('button', { name: /analyser avec l'ia/i }))

    expect(await screen.findByText(/analyse en cours/i)).toBeInTheDocument()

    resolveAnalyze(ANALYZED)
    await waitFor(() => {
      expect(screen.getByTestId('inspection-result-card')).toBeInTheDocument()
    })
  })

  it('affiche une erreur si l\'analyse échoue', async () => {
    inspectionService.createInspection.mockResolvedValue({ id: 42 })
    inspectionService.analyzeInspection.mockRejectedValue({
      response: { data: { detail: "Erreur du service d'analyse IA." } },
    })

    const { container } = renderPage()
    await screen.findByText('Tech Test')

    await userEvent.selectOptions(screen.getByLabelText(/machine à inspecter/i), '1')
    await uploadImage(container)
    await userEvent.click(screen.getByRole('button', { name: /analyser avec l'ia/i }))

    expect(await screen.findByText(/erreur du service d'analyse ia/i)).toBeInTheDocument()
    expect(screen.queryByTestId('inspection-result-card')).not.toBeInTheDocument()
  })

  it('affiche un message de validation si aucun fichier n\'est fourni', async () => {
    renderPage()
    await screen.findByText('Tech Test')

    await userEvent.selectOptions(screen.getByLabelText(/machine à inspecter/i), '1')
    await userEvent.click(screen.getByRole('button', { name: /analyser avec l'ia/i }))

    expect(await screen.findByText(/veuillez importer une image/i)).toBeInTheDocument()
    expect(inspectionService.createInspection).not.toHaveBeenCalled()
  })

  it('affiche un message de validation si aucune machine n\'est sélectionnée', async () => {
    const { container } = renderPage()
    await screen.findByText('Tech Test')

    await uploadImage(container)
    await userEvent.click(screen.getByRole('button', { name: /analyser avec l'ia/i }))

    expect(await screen.findByText(/veuillez sélectionner une machine/i)).toBeInTheDocument()
    expect(inspectionService.createInspection).not.toHaveBeenCalled()
  })

  it('affiche un état vide quand aucune inspection n\'existe', async () => {
    inspectionService.getInspections.mockResolvedValue({ count: 0, results: [] })
    renderPage()

    expect(await screen.findByText(/aucune inspection enregistrée/i)).toBeInTheDocument()
  })

  it('affiche une erreur si le chargement de l\'historique échoue', async () => {
    inspectionService.getInspections.mockRejectedValue(new Error('network'))
    renderPage()

    expect(await screen.findByText(/impossible de charger l'historique des inspections/i)).toBeInTheDocument()
  })

  it('affiche la pagination lorsque l\'historique dépasse une page', async () => {
    inspectionService.getInspections.mockResolvedValue({ count: 25, results: HISTORY })
    renderPage()

    expect(await screen.findByText(/page 1 sur 3/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /suivant/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /précédent/i })).toBeDisabled()
  })

  it('supprime une inspection après confirmation (administrateur)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    inspectionService.deleteInspection.mockResolvedValue({})
    renderPage('ADMIN')
    await screen.findByText('Tech Test')

    await userEvent.click(screen.getAllByTitle('Supprimer')[0])

    await waitFor(() => {
      expect(inspectionService.deleteInspection).toHaveBeenCalledWith(1)
    })
    confirmSpy.mockRestore()
  })

  it('masque la suppression pour le technicien', async () => {
    renderPage('TECHNICIEN')
    await screen.findByText('Tech Test')

    expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument()
    // Le technicien peut toujours lancer une inspection.
    expect(screen.getByRole('button', { name: /analyser avec l'ia/i })).toBeInTheDocument()
  })

  it('restreint l\'opérateur à la consultation', async () => {
    renderPage('OPERATEUR')
    await screen.findByText('Tech Test')

    expect(screen.queryByTestId('inspection-dropzone')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /analyser avec l'ia/i })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument()
    expect(screen.getByText(/accès en lecture seule/i)).toBeInTheDocument()
    // Il peut consulter l'historique.
    expect(screen.getByText('Tech Test')).toBeInTheDocument()
  })

  it('ouvre la fenêtre de détail au clic sur « Voir »', async () => {
    renderPage()
    await screen.findByText('Tech Test')

    await userEvent.click(screen.getAllByTitle('Voir')[0])

    const modal = await screen.findByTestId('inspection-detail-modal')
    expect(within(modal).getByText('Inspection #1')).toBeInTheDocument()
    expect(within(modal).getByText(/résultat de l'analyse ia/i)).toBeInTheDocument()
  })

  it('ouvre la visionneuse d\'image au clic sur « Voir l\'image »', async () => {
    renderPage()
    await screen.findByText('Tech Test')

    await userEvent.click(screen.getAllByTitle("Voir l'image")[0])

    expect(await screen.findByTestId('image-lightbox')).toBeInTheDocument()
  })
})
