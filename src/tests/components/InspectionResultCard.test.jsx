import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InspectionResultCard from '../../components/inspections/InspectionResultCard'

const baseInspection = {
  id: 7,
  machine_nom: 'Tour CNC',
  machine_identifiant: 'TC-004',
  date_inspection: '2026-10-03T10:00:00Z',
  statut_analyse: 'TERMINEE',
}

describe('InspectionResultCard — Module 4', () => {
  it('ne rend rien sans inspection', () => {
    const { container } = render(<InspectionResultCard inspection={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche les champs de résultat dénormalisés en priorité', () => {
    render(
      <InspectionResultCard
        inspection={{
          ...baseInspection,
          defect_detected: true,
          defect_type: 'Rayure',
          confidence: 0.75,
          observation: 'Nouvelle observation IA',
          // L'ancien résumé ne doit pas primer sur les champs de premier niveau.
          resultat_analyse: {
            defect_detected: false,
            defect_type: 'Ancien type',
            confidence: 0.1,
            localization: null,
            comment: 'Ancien commentaire',
          },
        }}
      />
    )

    expect(screen.getByText("Résultat de l'analyse")).toBeInTheDocument()
    expect(screen.getByText('Oui')).toBeInTheDocument()
    expect(screen.getByText('Rayure')).toBeInTheDocument()
    expect(screen.getByText('75 %')).toBeInTheDocument()
    expect(screen.getByText('Nouvelle observation IA')).toBeInTheDocument()
    expect(screen.queryByText('Ancien type')).not.toBeInTheDocument()
    expect(screen.queryByText('Ancien commentaire')).not.toBeInTheDocument()
  })

  it('retombe sur resultat_analyse quand les champs dénormalisés sont absents', () => {
    render(
      <InspectionResultCard
        inspection={{
          ...baseInspection,
          score_confiance: 0.91,
          resultat_analyse: {
            defect_detected: true,
            defect_type: 'Fissure',
            confidence: 0.91,
            localization: 'centre',
            comment: 'Fissure détectée sur la zone centre.',
          },
        }}
      />
    )

    expect(screen.getByText('Fissure')).toBeInTheDocument()
    expect(screen.getByText('91 %')).toBeInTheDocument()
    expect(screen.getByText('centre')).toBeInTheDocument()
    expect(screen.getByText(/fissure détectée sur la zone centre/i)).toBeInTheDocument()
  })

  it('affiche un état conforme quand aucun défaut n\'est détecté', () => {
    render(
      <InspectionResultCard
        inspection={{
          ...baseInspection,
          defect_detected: false,
          defect_type: '',
          confidence: 0.66,
          observation: 'État conforme.',
          resultat_analyse: {
            defect_detected: false, defect_type: null, confidence: 0.66,
            localization: null, comment: 'État conforme.',
          },
        }}
      />
    )

    expect(screen.getByText('Non')).toBeInTheDocument()
    expect(screen.getByText('66 %')).toBeInTheDocument()
    expect(screen.queryByText('Oui')).not.toBeInTheDocument()
  })

  it('affiche le message d\'erreur en cas d\'échec de l\'analyse', () => {
    render(
      <InspectionResultCard
        inspection={{
          ...baseInspection,
          statut_analyse: 'ERREUR',
          erreur_message: "Erreur lors de l'analyse : modèle indisponible",
          resultat_analyse: null,
        }}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/modèle indisponible/i)
    // Aucun bloc de résultat en cas d'erreur.
    expect(screen.queryByText('Type de défaut')).not.toBeInTheDocument()
  })

  it('affiche la machine et la date inspectée', () => {
    render(
      <InspectionResultCard
        inspection={{ ...baseInspection, resultat_analyse: { defect_detected: false } }}
      />
    )

    expect(screen.getByText(/Tour CNC \(TC-004\)/)).toBeInTheDocument()
  })
})
