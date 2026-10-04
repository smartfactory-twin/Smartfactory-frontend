import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ProfilePage from '../../components/common/ProfilePage'
import { AuthContext } from '../../context/AuthContext'
import * as profileService from '../../services/profileService'
import * as perimetreService from '../../services/perimetreService'

vi.mock('../../services/profileService', () => ({
  updateProfile:   vi.fn(),
  changePassword:  vi.fn(),
}))

vi.mock('../../services/perimetreService', () => ({
  getMonPerimetre: vi.fn(),
  getPerimetres:   vi.fn(),
  createPerimetre: vi.fn(),
  updatePerimetre: vi.fn(),
  deletePerimetre: vi.fn(),
  NIVEAUX: [
    { value: 'ligne',   label: 'Ligne de production' },
    { value: 'zone',    label: 'Zone / Atelier' },
    { value: 'usine',   label: 'Usine' },
    { value: 'machine', label: 'Machine' },
  ],
}))

/** Affectation « ligne » exactement telle que renvoyée par le backend. */
const AFFECTATION_LIGNE = {
  id: 1,
  utilisateur: 46,
  utilisateur_nom: 'Amine Brahmi',
  niveau: 'ligne',
  libelle: 'Usine Industrielle Sousse → Atelier Usinage → Ligne Usinage 01',
  usine: null, zone: null, ligne: 100, machine: null,
  actif: true, est_active: true, date_debut: null, date_fin: null,
  machines_accessibles: [
    { id: 1, nom: 'Tour CNC',          identifiant_interne: 'CNC-101', statut: 'NORMAL' },
    { id: 2, nom: 'Fraiseuse CNC',     identifiant_interne: 'CNC-102', statut: 'NORMAL' },
  ],
  nb_machines_accessibles: 2,
  cible_ids: { usine: 1, zone: 10, ligne: 100, machine: null },
}

const AFFECTATION_ZONE = {
  id: 2,
  utilisateur: 46,
  niveau: 'zone',
  libelle: 'Usine Industrielle Sousse → Atelier Assemblage',
  usine: null, zone: 11, ligne: null, machine: null,
  actif: true, est_active: true,
  machines_accessibles: [
    { id: 3, nom: 'Robot Assembleur', identifiant_interne: 'ROB-001', statut: 'DEGRADE' },
  ],
  nb_machines_accessibles: 1,
  cible_ids: { usine: 1, zone: 11, ligne: null, machine: null },
}

const MACHINES_OP = [
  { id: 1, nom: 'Tour CNC',      identifiant_interne: 'CNC-101', statut: 'NORMAL', ligne: 100, ligne_nom: 'Ligne Usinage 01' },
  { id: 2, nom: 'Fraiseuse CNC', identifiant_interne: 'CNC-102', statut: 'NORMAL', ligne: 100, ligne_nom: 'Ligne Usinage 01' },
]

function renderProfil(user = { id: 46, prenom: 'Amine', nom: 'Brahmi', role: 'OPERATEUR', email: 'a@b.tn' }) {
  const ctxValue = {
    user,
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
  }
  return render(<AuthContext.Provider value={ctxValue}><ProfilePage /></AuthContext.Provider>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

/* ══════════════════════════════════════════════════════════════════════════
   OPERATEUR
   ══════════════════════════════════════════════════════════════════════════ */

describe('ProfilePage — Mon périmètre d’accès (OPERATEUR)', () => {
  it('test 5 — affiche la section « Mon périmètre d’accès »', async () => {
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'OPERATEUR', acces_global: false,
      nb_machines_accessibles: 2, machines: MACHINES_OP,
      affectations: [AFFECTATION_LIGNE],
    })
    renderProfil()

    expect(await screen.findByText('Mon périmètre d’accès')).toBeInTheDocument()
  })

  it('test 5 — affiche usine → zone → ligne et les machines accessibles', async () => {
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'OPERATEUR', acces_global: false,
      nb_machines_accessibles: 2, machines: MACHINES_OP,
      affectations: [AFFECTATION_LIGNE],
    })
    renderProfil()

    expect(await screen.findByText(AFFECTATION_LIGNE.libelle)).toBeInTheDocument()
    // Chaîne hiérarchique remontée par le backend (cible_ids).
    expect(screen.getByText('Usine #1')).toBeInTheDocument()
    expect(screen.getByText('Zone #10')).toBeInTheDocument()
    expect(screen.getByText('Ligne #100')).toBeInTheDocument()
    // Machines réellement accessibles.
    expect(screen.getByText('CNC-101')).toBeInTheDocument()
    expect(screen.getByText('Tour CNC')).toBeInTheDocument()
    expect(screen.getByText('CNC-102')).toBeInTheDocument()
  })

  it('test 5 — affiche le compteur « X machines accessibles »', async () => {
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'OPERATEUR', acces_global: false,
      nb_machines_accessibles: 2, machines: MACHINES_OP,
      affectations: [AFFECTATION_LIGNE],
    })
    renderProfil()

    // Le compteur apparaît en en-tête (total) et sur l'affectation : 2 occurrences.
    await waitFor(() => {
      expect(screen.getAllByText('2 machine(s) accessible(s)')).toHaveLength(2)
    })
  })

  it('test 9 — n’affiche que les machines renvoyées par le backend', async () => {
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'OPERATEUR', acces_global: false,
      nb_machines_accessibles: 2, machines: MACHINES_OP,
      affectations: [AFFECTATION_LIGNE],
    })
    renderProfil()

    await screen.findByText('CNC-101')
    // Une machine hors périmètre ne doit jamais apparaître.
    expect(screen.queryByText('CNC-201')).not.toBeInTheDocument()
    expect(screen.queryByText('Ligne Assemblage 01')).not.toBeInTheDocument()
  })

  it('test 7 — affiche clairement l’absence d’affectation', async () => {
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'OPERATEUR', acces_global: false,
      nb_machines_accessibles: 0, machines: [], affectations: [],
    })
    renderProfil()

    expect(
      await screen.findByText(/Aucune affectation configurée\. Contactez l’administrateur/)
    ).toBeInTheDocument()
    expect(screen.queryByText('CNC-101')).not.toBeInTheDocument()
  })

  it('affiche un état de chargement', () => {
    perimetreService.getMonPerimetre.mockReturnValue(new Promise(() => {}))
    renderProfil()
    expect(screen.getByText('Chargement de votre périmètre…')).toBeInTheDocument()
  })

  it('affiche une erreur API lisible', async () => {
    perimetreService.getMonPerimetre.mockRejectedValue(new Error('boom'))
    renderProfil()
    expect(
      await screen.findByText('Impossible de charger votre périmètre d’accès.')
    ).toBeInTheDocument()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   TECHNICIEN — plusieurs périmètres
   ══════════════════════════════════════════════════════════════════════════ */

describe('ProfilePage — Mon périmètre d’accès (TECHNICIEN)', () => {
  it('test 5 — affiche toutes les affectations du technicien', async () => {
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'TECHNICIEN', acces_global: false,
      nb_machines_accessibles: 3,
      machines: [...MACHINES_OP, { id: 3, nom: 'Robot Assembleur', identifiant_interne: 'ROB-001', statut: 'DEGRADE', ligne: 200, ligne_nom: 'Ligne Assemblage 01' }],
      affectations: [AFFECTATION_LIGNE, AFFECTATION_ZONE],
    })
    renderProfil({ id: 47, prenom: 'Yassine', nom: 'Trabelsi', role: 'TECHNICIEN', email: 'y@t.tn' })

    expect(await screen.findByText(AFFECTATION_LIGNE.libelle)).toBeInTheDocument()
    expect(screen.getByText(AFFECTATION_ZONE.libelle)).toBeInTheDocument()
    expect(screen.getByText('ROB-001')).toBeInTheDocument()
    expect(screen.getByText('3 machine(s) accessible(s)')).toBeInTheDocument()
  })

  it('test 9 — le compteur d’en-tête est celui renvoyé par le backend', async () => {
    // Compteur global = union réellement accessible (3), et chaque affectation
    // conserve son propre décompte (2 et 1) : rien n'est recalculé côté UI.
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'TECHNICIEN', acces_global: false,
      nb_machines_accessibles: 3,
      machines: [
        ...MACHINES_OP,
        { id: 3, nom: 'Robot Assembleur', identifiant_interne: 'ROB-001', statut: 'DEGRADE', ligne: 200, ligne_nom: 'Ligne Assemblage 01' },
      ],
      affectations: [AFFECTATION_LIGNE, AFFECTATION_ZONE],
    })
    renderProfil({ id: 47, prenom: 'Yassine', nom: 'Trabelsi', role: 'TECHNICIEN', email: 'y@t.tn' })

    await waitFor(() => expect(screen.getByText('3 machine(s) accessible(s)')).toBeInTheDocument())
    expect(screen.getByText('2 machine(s) accessible(s)')).toBeInTheDocument()
    expect(screen.getByText('1 machine(s) accessible(s)')).toBeInTheDocument()
  })

  it('technicien sans affectation : aucun accès (fail-closed)', async () => {
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'TECHNICIEN', acces_global: false,
      nb_machines_accessibles: 0, machines: [], affectations: [],
    })
    renderProfil({ id: 47, prenom: 'Yassine', nom: 'Trabelsi', role: 'TECHNICIEN', email: 'y@t.tn' })

    // Le backend ne renvoie plus aucune machine : l'UI ne peut rien inventer.
    await waitFor(() => expect(screen.getByText('0 machine(s) accessible(s)')).toBeInTheDocument())
    expect(screen.getByText(/Aucune affectation configurée/)).toBeInTheDocument()
    expect(screen.queryByText('CNC-101')).not.toBeInTheDocument()
    expect(screen.queryByText('ROB-001')).not.toBeInTheDocument()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   ADMIN — accès global
   ══════════════════════════════════════════════════════════════════════════ */

describe('ProfilePage — Mon périmètre d’accès (ADMIN)', () => {
  it('test 6 — indique l’accès global sans demander d’affectation', async () => {
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'ADMIN', role_label: 'Administrateur', acces_global: true,
      nb_machines_accessibles: 42, machines: [], affectations: [],
    })
    renderProfil({ id: 1, prenom: 'Admin', nom: 'Site', role: 'ADMIN', email: 'a@a.tn' })

    expect(await screen.findByText('Mon périmètre d’accès')).toBeInTheDocument()
    expect(screen.getByText(/accès global/)).toBeInTheDocument()
    expect(screen.queryByText(/Aucune affectation configurée/)).not.toBeInTheDocument()
  })

  it('test 6 — n’affiche aucun compteur de périmètre pour l’ADMIN', async () => {
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'ADMIN', acces_global: true,
      nb_machines_accessibles: 42, machines: [], affectations: [],
    })
    renderProfil({ id: 1, prenom: 'Admin', nom: 'Site', role: 'ADMIN', email: 'a@a.tn' })

    await screen.findByText(/accès global/)
    expect(screen.queryByText(/machine\(s\) accessible\(s\)/)).not.toBeInTheDocument()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   Lecture seule — l'utilisateur ne peut pas modifier son propre périmètre
   ══════════════════════════════════════════════════════════════════════════ */

describe('ProfilePage — Mon périmètre d’accès est en lecture seule', () => {
  beforeEach(() => {
    perimetreService.getMonPerimetre.mockResolvedValue({
      role: 'OPERATEUR', acces_global: false,
      nb_machines_accessibles: 2, machines: MACHINES_OP,
      affectations: [AFFECTATION_LIGNE],
    })
  })

  it('test 8 — n’expose aucun contrôle d’édition ni de suppression', async () => {
    renderProfil()
    await screen.findByText(AFFECTATION_LIGNE.libelle)

    expect(screen.queryByRole('button', { name: /ajouter une affectation/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Modifier / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Supprimer / })).not.toBeInTheDocument()
    // Aucun <select> : la section est purement informative.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('test 8 — n’appelle jamais les endpoints d’écriture', async () => {
    renderProfil()
    await screen.findByText(AFFECTATION_LIGNE.libelle)

    expect(perimetreService.getMonPerimetre).toHaveBeenCalled()
    expect(perimetreService.createPerimetre).not.toHaveBeenCalled()
    expect(perimetreService.updatePerimetre).not.toHaveBeenCalled()
    expect(perimetreService.deletePerimetre).not.toHaveBeenCalled()
  })

  it('test 8 — la lecture passe par l’endpoint du périmètre résolu', async () => {
    renderProfil()
    await waitFor(() => expect(perimetreService.getMonPerimetre).toHaveBeenCalledTimes(1))
  })
})