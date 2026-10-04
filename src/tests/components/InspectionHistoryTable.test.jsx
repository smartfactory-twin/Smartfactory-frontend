import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InspectionHistoryTable from '../../components/inspections/InspectionHistoryTable'

const TOP_LEVEL = {
  id: 1,
  machine_nom: 'Tour CNC',
  machine_identifiant: 'TC-004',
  utilisateur_nom: 'Admin Test',
  date_inspection: '2026-10-03T10:00:00Z',
  statut_analyse: 'TERMINEE',
  defect_detected: true,
  defect_type: 'Rayure',
  confidence: 0.75,
  image: 'http://localhost/media/inspections/images/1.png',
  resultat_analyse: {
    defect_detected: false, defect_type: 'Ancien', confidence: 0.1,
    localization: null, comment: 'ancien',
  },
}

const FALLBACK = {
  id: 2,
  machine_nom: 'Presse hydraulique',
  machine_identifiant: 'PH-001',
  utilisateur_nom: 'Tech Test',
  date_inspection: '2026-10-01T08:00:00Z',
  statut_analyse: 'TERMINEE',
  score_confiance: 0.88,
  image: null,
  resultat_analyse: {
    defect_detected: false, defect_type: null, confidence: 0.88,
    localization: null, comment: 'État conforme.',
  },
}

describe('InspectionHistoryTable — Module 4', () => {
  it('affiche les champs dénormalisés (type de défaut + confiance)', () => {
    render(<InspectionHistoryTable inspections={[TOP_LEVEL]} />)

    expect(screen.getByText('Rayure')).toBeInTheDocument()
    expect(screen.getByText('75 %')).toBeInTheDocument()
    expect(screen.getByText('Admin Test')).toBeInTheDocument()
    expect(screen.getByText('TC-004')).toBeInTheDocument()
    expect(screen.queryByText('Ancien')).not.toBeInTheDocument()
  })

  it('retombe sur resultat_analyse / score_confiance quand nécessaire', () => {
    render(<InspectionHistoryTable inspections={[FALLBACK]} />)

    expect(screen.getByText('Aucun défaut')).toBeInTheDocument()
    expect(screen.getByText('88 %')).toBeInTheDocument()
  })

  it('affiche l\'état vide quand il n\'y a aucune inspection', () => {
    render(<InspectionHistoryTable inspections={[]} />)
    expect(screen.getByText(/aucune inspection enregistrée/i)).toBeInTheDocument()
  })

  it('affiche un indicateur de chargement', () => {
    render(<InspectionHistoryTable inspections={[]} loading />)
    expect(screen.queryByText(/aucune inspection enregistrée/i)).not.toBeInTheDocument()
  })

  it('affiche une erreur de chargement', () => {
    render(<InspectionHistoryTable inspections={[]} error="Erreur réseau" />)
    expect(screen.getByText(/erreur réseau/i)).toBeInTheDocument()
  })

  it('déclenche les callbacks de consultation', async () => {
    const onView = vi.fn()
    const onViewImage = vi.fn()
    const onViewResult = vi.fn()
    render(
      <InspectionHistoryTable
        inspections={[TOP_LEVEL]}
        onView={onView}
        onViewImage={onViewImage}
        onViewResult={onViewResult}
      />
    )

    await userEvent.click(screen.getByTitle('Voir'))
    // Deux boutons « Voir l'image » : la vignette et l'action de la colonne Actions.
    await userEvent.click(screen.getAllByTitle("Voir l'image")[0])
    await userEvent.click(screen.getByTitle('Voir le résultat'))

    expect(onView).toHaveBeenCalledWith(TOP_LEVEL)
    expect(onViewImage).toHaveBeenCalledWith(TOP_LEVEL)
    expect(onViewResult).toHaveBeenCalledWith(TOP_LEVEL)
  })

  it('affiche et déclenche la suppression seulement si autorisée', async () => {
    const onDelete = vi.fn()

    const { rerender } = render(<InspectionHistoryTable inspections={[TOP_LEVEL]} />)
    expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument()

    rerender(
      <InspectionHistoryTable inspections={[TOP_LEVEL]} canDelete onDelete={onDelete} />
    )
    await userEvent.click(screen.getByTitle('Supprimer'))
    expect(onDelete).toHaveBeenCalledWith(TOP_LEVEL)
  })
})
