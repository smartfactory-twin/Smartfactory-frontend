import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScopeManager from '../../components/users/ScopeManager'
import * as perimetreService from '../../services/perimetreService'
import * as machineService from '../../services/machineService'

vi.mock('../../services/perimetreService', () => ({
  getPerimetres:    vi.fn(),
  createPerimetre:   vi.fn(),
  updatePerimetre:   vi.fn(),
  deletePerimetre:   vi.fn(),
  getMonPerimetre:   vi.fn(),
  NIVEAUX: [
    { value: 'ligne',   label: 'Ligne de production' },
    { value: 'zone',    label: 'Zone / Atelier' },
    { value: 'usine',   label: 'Usine' },
    { value: 'machine', label: 'Machine' },
  ],
}))

vi.mock('../../services/machineService', () => ({
  getUsines:  vi.fn(),
  getZones:   vi.fn(),
  getLignes:  vi.fn(),
  getMachines: vi.fn(),
}))

const USINES = [
  { id: 1, nom: 'Usine Industrielle Sousse' },
  { id: 2, nom: 'Usine Industrielle Tunis' },
]
const ZONES_U1 = [
  { id: 10, nom: 'Atelier Usinage', usine: 1 },
  { id: 11, nom: 'Atelier Assemblage', usine: 1 },
  { id: 12, nom: 'Atelier Finition', usine: 1 },
]
const LIGNES_Z10 = [{ id: 100, nom: 'Ligne Usinage 01', zone: 10 }]

/** Deux affectations telles que renvoyées par l'API `UserScopeSerializer`. */
const SCOPE_LIGNE = {
  id: 1,
  utilisateur: 46,
  utilisateur_nom: 'Amine Brahmi',
  niveau: 'ligne',
  libelle: 'Usine Industrielle Sousse → Atelier Usinage → Ligne Usinage 01',
  usine: null, usine_nom: null,
  zone: null, zone_nom: null,
  ligne: 100, ligne_nom: 'Ligne Usinage 01',
  machine: null, machine_nom: null, machine_identifiant: null,
  actif: true, est_active: true, date_debut: null, date_fin: null,
  machines_accessibles: [
    { id: 1, nom: 'Tour CNC', identifiant_interne: 'CNC-101', statut: 'NORMAL' },
    { id: 2, nom: 'Fraiseuse CNC', identifiant_interne: 'CNC-102', statut: 'NORMAL' },
  ],
  nb_machines_accessibles: 2,
  cible_ids: { usine: 1, zone: 10, ligne: 100, machine: null },
}

const SCOPE_ZONE = {
  id: 2,
  utilisateur: 46,
  niveau: 'zone',
  libelle: 'Usine Industrielle Sousse → Atelier Assemblage',
  usine: null, zone: 11, ligne: null, machine: null,
  actif: true, est_active: true, date_debut: null, date_fin: null,
  machines_accessibles: [
    { id: 3, nom: 'Robot', identifiant_interne: 'ROB-001', statut: 'DEGRADE' },
  ],
  nb_machines_accessibles: 1,
  cible_ids: { usine: 1, zone: 11, ligne: null, machine: null },
}

function mount(props = {}) {
  return render(<ScopeManager utilisateurId={46} {...props} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  machineService.getUsines.mockResolvedValue(USINES)
  machineService.getZones.mockResolvedValue(ZONES_U1)
  machineService.getLignes.mockResolvedValue(LIGNES_Z10)
  machineService.getMachines.mockResolvedValue([])
  perimetreService.getPerimetres.mockResolvedValue({ count: 0, results: [] })
  perimetreService.createPerimetre.mockResolvedValue(SCOPE_LIGNE)
  perimetreService.updatePerimetre.mockResolvedValue(SCOPE_LIGNE)
  perimetreService.deletePerimetre.mockResolvedValue(null)
})

/* ══════════════════════════════════════════════════════════════════════════
   Lecture des affectations
   ══════════════════════════════════════════════════════════════════════════ */

describe('ScopeManager — lecture des affectations', () => {
  it('affiche « Aucune affectation configurée. » quand l’API n’en renvoie aucune', async () => {
    mount()
    await waitFor(() => {
      expect(screen.getByText('Aucune affectation configurée.')).toBeInTheDocument()
    })
  })

  it('affiche l’état de chargement avant la réponse de l’API', () => {
    let resolve
    perimetreService.getPerimetres.mockReturnValue(
      new Promise(r => { resolve = r })
    )
    mount()
    expect(screen.getByText('Chargement des affectations…')).toBeInTheDocument()
    resolve({ count: 0, results: [] })
  })

  it('affiche une erreur API lisible', async () => {
    perimetreService.getPerimetres.mockRejectedValue(new Error('boom'))
    mount()
    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les affectations.')).toBeInTheDocument()
    })
  })

  it('filtre la liste sur l’utilisateur demandé', async () => {
    mount()
    await waitFor(() => expect(perimetreService.getPerimetres).toHaveBeenCalled())
    expect(perimetreService.getPerimetres).toHaveBeenCalledWith({ utilisateur: 46 })
  })

  it('test 9 — affiche exactement les affectations renvoyées par l’API UserScope', async () => {
    perimetreService.getPerimetres.mockResolvedValue({
      count: 2, results: [SCOPE_LIGNE, SCOPE_ZONE],
    })
    mount()

    // Les libellés affichés sont ceux fournis par le backend, jamais recalculés.
    await waitFor(() => {
      expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument()
    })
    expect(screen.getByText(SCOPE_ZONE.libelle)).toBeInTheDocument()
    expect(screen.queryByText(/Ligne Assemblage 01/)).not.toBeInTheDocument()

    // Et le compteur par affectation vient bien du backend.
    expect(screen.getByText('2 machine(s) accessible(s)')).toBeInTheDocument()
    expect(screen.getByText('1 machine(s) accessible(s)')).toBeInTheDocument()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   Ajout d'une affectation
   ══════════════════════════════════════════════════════════════════════════ */

describe('ScopeManager — ajout d’une affectation', () => {
  async function ouvrirFormulaire() {
    await userEvent.click(screen.getByRole('button', { name: /ajouter une affectation/i }))
  }

  /** Le formulaire d'ajout ET celui de modification se valident par « Enregistrer ». */
  async function valider() {
    await userEvent.click(screen.getByRole('button', { name: /^enregistrer l.affectation$/i }))
  }

  async function selectionLigne() {
    await userEvent.selectOptions(screen.getByLabelText('Usine'), '1')
    await waitFor(() => expect(screen.getByLabelText('Zone / Atelier')).not.toBeDisabled())
    await userEvent.selectOptions(screen.getByLabelText('Zone / Atelier'), '10')
    await waitFor(() => expect(screen.getByLabelText('Ligne de production')).not.toBeDisabled())
    await userEvent.selectOptions(screen.getByLabelText('Ligne de production'), '100')
  }

  it('test 2 — un technicien peut cumuler plusieurs affectations de niveaux différents', async () => {
    perimetreService.getPerimetres.mockResolvedValue({
      count: 2, results: [SCOPE_LIGNE, SCOPE_ZONE],
    })
    mount()

    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())
    // Deux périmètres distincts coexistent.
    expect(screen.getByText(SCOPE_ZONE.libelle)).toBeInTheDocument()

    await ouvrirFormulaire()
    await userEvent.selectOptions(screen.getByLabelText('Niveau'), 'zone')
    await userEvent.selectOptions(screen.getByLabelText('Usine'), '1')
    await waitFor(() => expect(screen.getByLabelText('Zone / Atelier')).not.toBeDisabled())
    // Zone 12 : volontairement différente de SCOPE_ZONE (11) déjà présente.
    await userEvent.selectOptions(screen.getByLabelText('Zone / Atelier'), '12')
    await valider()

    await waitFor(() => {
      expect(perimetreService.createPerimetre).toHaveBeenCalledWith({
        utilisateur: 46, zone: 12,
      })
    })
  })

  it('respecte la hiérarchie : la zone est filtrée par l’usine choisie', async () => {
    mount()
    await ouvrirFormulaire()
    await userEvent.selectOptions(screen.getByLabelText('Usine'), '1')

    await waitFor(() => {
      expect(machineService.getZones).toHaveBeenCalledWith({ usine: '1', page_size: 200 })
    })
    const zoneSelect = screen.getByLabelText('Zone / Atelier')
    const labels = [...zoneSelect.options].map(o => o.textContent)
    expect(labels).toContain('Atelier Usinage')
    expect(labels).toContain('Atelier Assemblage')
  })

  it('la ligne est filtrée par la zone choisie', async () => {
    mount()
    await ouvrirFormulaire()
    await userEvent.selectOptions(screen.getByLabelText('Usine'), '1')
    await waitFor(() => expect(screen.getByLabelText('Zone / Atelier')).not.toBeDisabled())
    await userEvent.selectOptions(screen.getByLabelText('Zone / Atelier'), '10')

    await waitFor(() => {
      expect(machineService.getLignes).toHaveBeenCalledWith({ zone: '10', page_size: 200 })
    })
  })

  it('réinitialise la zone quand une nouvelle usine est choisie', async () => {
    mount()
    await ouvrirFormulaire()
    await userEvent.selectOptions(screen.getByLabelText('Usine'), '1')
    await waitFor(() => expect(screen.getByLabelText('Zone / Atelier')).not.toBeDisabled())
    await userEvent.selectOptions(screen.getByLabelText('Zone / Atelier'), '10')
    expect(screen.getByLabelText('Zone / Atelier')).toHaveValue('10')

    await userEvent.selectOptions(screen.getByLabelText('Usine'), '2')
    expect(screen.getByLabelText('Zone / Atelier')).toHaveValue('')
  })

  it('n’envoie qu’un seul niveau (jamais une combinaison incohérente)', async () => {
    mount()
    await ouvrirFormulaire()
    await selectionLigne()
    await valider()

    await waitFor(() => {
      expect(perimetreService.createPerimetre).toHaveBeenCalledWith({
        utilisateur: 46, ligne: 100,
      })
    })
    const payload = perimetreService.createPerimetre.mock.calls[0][0]
    expect(Object.keys(payload).sort()).toEqual(['ligne', 'utilisateur'])
  })

  it('refuse une affectation sans cible sélectionnée', async () => {
    mount()
    await ouvrirFormulaire()
    await valider()

    expect(await screen.findByText('Sélectionnez un élément à affecter.')).toBeInTheDocument()
    expect(perimetreService.createPerimetre).not.toHaveBeenCalled()
  })

  it('refuse un doublon', async () => {
    perimetreService.getPerimetres.mockResolvedValue({ count: 1, results: [SCOPE_LIGNE] })
    mount()
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())

    await ouvrirFormulaire()
    await selectionLigne()
    await valider()

    expect(await screen.findByText('Cette affectation existe déjà.')).toBeInTheDocument()
    expect(perimetreService.createPerimetre).not.toHaveBeenCalled()
  })

  it('affiche un message de succès après l’ajout', async () => {
    mount()
    await ouvrirFormulaire()
    await selectionLigne()
    await valider()

    expect(await screen.findByText('Affectation ajoutée avec succès.')).toBeInTheDocument()
  })

  it('affiche l’erreur API si la création échoue', async () => {
    perimetreService.createPerimetre.mockRejectedValue({
      response: { data: { ligne: ['Ligne introuvable.'] } },
    })
    mount()
    await ouvrirFormulaire()
    await selectionLigne()
    await valider()

    expect(await screen.findByText('Ligne introuvable.')).toBeInTheDocument()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   Modification
   ══════════════════════════════════════════════════════════════════════════ */

describe('ScopeManager — modification d’une affectation', () => {
  const boutonModifier = () =>
    screen.getByRole('button', { name: new RegExp(`^Modifier ${SCOPE_LIGNE.libelle}`) })

  it('test 3 — pré-remplit le sélecteur avec l’affectation existante', async () => {
    perimetreService.getPerimetres.mockResolvedValue({ count: 1, results: [SCOPE_LIGNE] })
    mount()
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())

    await userEvent.click(boutonModifier())

    expect(screen.getByLabelText('Niveau')).toHaveValue('ligne')
    await waitFor(() => expect(screen.getByLabelText('Usine')).toHaveValue('1'))
    expect(screen.getByLabelText('Zone / Atelier')).toHaveValue('10')
    expect(screen.getByLabelText('Ligne de production')).toHaveValue('100')
  })

  it('test 3 — envoie un PATCH en vidant l’ancien niveau avant la nouvelle cible', async () => {
    perimetreService.getPerimetres.mockResolvedValue({ count: 1, results: [SCOPE_LIGNE] })
    mount()
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())

    await userEvent.click(boutonModifier())
    await userEvent.selectOptions(screen.getByLabelText('Niveau'), 'zone')
    await waitFor(() => expect(screen.getByLabelText('Zone / Atelier')).not.toBeDisabled())
    await userEvent.selectOptions(screen.getByLabelText('Zone / Atelier'), '11')
    await userEvent.click(screen.getByRole('button', { name: /^enregistrer l.affectation$/i }))

    await waitFor(() => {
      expect(perimetreService.updatePerimetre).toHaveBeenCalledWith(1, {
        usine: null, zone: 11, ligne: null, machine: null,
      })
    })
  })

  it('affiche un message de succès après la modification', async () => {
    perimetreService.getPerimetres.mockResolvedValue({ count: 1, results: [SCOPE_LIGNE] })
    mount()
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())

    await userEvent.click(boutonModifier())
    await waitFor(() => expect(screen.getByLabelText('Usine')).toHaveValue('1'))
    await userEvent.click(screen.getByRole('button', { name: /^enregistrer l.affectation$/i }))

    expect(await screen.findByText('Affectation modifiée avec succès.')).toBeInTheDocument()
  })

  it('recharge la liste après la modification', async () => {
    perimetreService.getPerimetres.mockResolvedValue({ count: 1, results: [SCOPE_LIGNE] })
    mount()
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())
    const callsBefore = perimetreService.getPerimetres.mock.calls.length

    await userEvent.click(boutonModifier())
    await waitFor(() => expect(screen.getByLabelText('Usine')).toHaveValue('1'))
    await userEvent.click(screen.getByRole('button', { name: /^enregistrer l.affectation$/i }))

    await waitFor(() => {
      expect(perimetreService.getPerimetres.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it('permet d’annuler la modification sans écrire', async () => {
    perimetreService.getPerimetres.mockResolvedValue({ count: 1, results: [SCOPE_LIGNE] })
    mount()
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())

    await userEvent.click(boutonModifier())
    await waitFor(() => expect(screen.getByLabelText('Usine')).toHaveValue('1'))
    await userEvent.click(screen.getByRole('button', { name: /annuler/i }))

    expect(perimetreService.updatePerimetre).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Niveau')).not.toBeInTheDocument()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   Suppression
   ══════════════════════════════════════════════════════════════════════════ */

describe('ScopeManager — suppression d’une affectation', () => {
  /** Bouton « Supprimer <libelle> » de la ligne d'affectation. */
  const boutonSupprimerLigne = () =>
    screen.getByRole('button', { name: new RegExp(`^Supprimer ${SCOPE_LIGNE.libelle}`) })

  /** Bouton « Supprimer » du bloc de confirmation (nom exact). */
  const boutonConfirmer = () =>
    (within(screen.getByRole('group', { name: 'Confirmation de suppression' })).getByRole('button', { name: 'Supprimer' }))

  beforeEach(() => {
    perimetreService.getPerimetres.mockResolvedValue({ count: 1, results: [SCOPE_LIGNE] })
  })

  it('test 4 — demande une confirmation avant de supprimer', async () => {
    mount()
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())

    await userEvent.click(boutonSupprimerLigne())

    expect(screen.getByText(/Supprimer l’affectation/)).toBeInTheDocument()
    expect(perimetreService.deletePerimetre).not.toHaveBeenCalled()
  })

  it('n’efface rien si l’on annule la confirmation', async () => {
    mount()
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())

    await userEvent.click(boutonSupprimerLigne())
    await userEvent.click(screen.getByRole('button', { name: /annuler/i }))

    expect(perimetreService.deletePerimetre).not.toHaveBeenCalled()
  })

  it('test 4 — supprime après confirmation et confirme le succès', async () => {
    mount()
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())

    await userEvent.click(boutonSupprimerLigne())
    await userEvent.click(boutonConfirmer())

    await waitFor(() => {
      expect(perimetreService.deletePerimetre).toHaveBeenCalledWith(1)
    })
    expect(await screen.findByText('Affectation supprimée avec succès.')).toBeInTheDocument()
  })

  it('test 4 — recharge la liste après suppression', async () => {
    mount()
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())
    const callsBefore = perimetreService.getPerimetres.mock.calls.length

    await userEvent.click(boutonSupprimerLigne())
    await userEvent.click(boutonConfirmer())

    await waitFor(() => {
      expect(perimetreService.getPerimetres.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   Lecture seule (exigence : l'utilisateur standard ne modifie pas son périmètre)
   ══════════════════════════════════════════════════════════════════════════ */

describe('ScopeManager — lecture seule', () => {
  beforeEach(() => {
    perimetreService.getPerimetres.mockResolvedValue({ count: 1, results: [SCOPE_LIGNE] })
  })

  it('test 8 — n’expose ni bouton de modification ni bouton de suppression', async () => {
    mount({ readOnly: true })
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /^Modifier / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Supprimer / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ajouter une affectation/i })).not.toBeInTheDocument()
  })

  it('test 8 — n’appelle jamais les endpoints d’écriture', async () => {
    mount({ readOnly: true })
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())

    expect(perimetreService.createPerimetre).not.toHaveBeenCalled()
    expect(perimetreService.updatePerimetre).not.toHaveBeenCalled()
    expect(perimetreService.deletePerimetre).not.toHaveBeenCalled()
  })

  it('affiche quand même les affectations en lecture seule', async () => {
    mount({ readOnly: true })
    await waitFor(() => expect(screen.getByText(SCOPE_LIGNE.libelle)).toBeInTheDocument())
    expect(screen.getByText('2 machine(s) accessible(s)')).toBeInTheDocument()
  })
})