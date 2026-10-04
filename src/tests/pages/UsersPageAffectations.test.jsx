import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import UsersPage from '../../pages/admin/UsersPage'
import { AuthContext } from '../../context/AuthContext'
import * as authService from '../../services/authService'
import * as machineService from '../../services/machineService'
import * as perimetreService from '../../services/perimetreService'

vi.mock('../../services/authService', () => ({
  adminCreateUser: vi.fn(),
  listUsers:       vi.fn(),
  deleteUser:      vi.fn(),
  updateUserAdmin: vi.fn(),
  getMe:           vi.fn(),
}))

vi.mock('../../services/machineService', () => ({
  getUsines:   vi.fn(),
  getZones:    vi.fn(),
  getLignes:   vi.fn(),
  getMachines: vi.fn(),
}))

vi.mock('../../services/perimetreService', () => ({
  getPerimetres:  vi.fn(),
  createPerimetre: vi.fn(),
  updatePerimetre: vi.fn(),
  deletePerimetre: vi.fn(),
  getMonPerimetre: vi.fn(),
  NIVEAUX: [
    { value: 'ligne',   label: 'Ligne de production' },
    { value: 'zone',    label: 'Zone / Atelier' },
    { value: 'usine',   label: 'Usine' },
    { value: 'machine', label: 'Machine' },
  ],
}))

const USINES = [{ id: 1, nom: 'Usine Industrielle Sousse' }]
const ZONES  = [{ id: 10, nom: 'Atelier Usinage', usine: 1 }]
const LIGNES = [
  { id: 100, nom: 'Ligne Usinage 01', zone: 10 },
  { id: 200, nom: 'Ligne Assemblage 01', zone: 10 },
]

const EXISTING_USER = {
  id: 46, prenom: 'Karim', nom: 'Benamor',
  email: 'karim.benamor@smartfactory.tn', role: 'OPERATEUR', actif: true,
}

/** Affectation existante, format `UserScopeSerializer`. */
const SCOPE_EXISTANTE = {
  id: 7,
  utilisateur: 46,
  niveau: 'ligne',
  libelle: 'Usine Industrielle Sousse → Atelier Usinage → Ligne Usinage 01',
  usine: null, zone: null, ligne: 100, machine: null,
  actif: true, est_active: true,
  machines_accessibles: [
    { id: 1, nom: 'Tour CNC', identifiant_interne: 'CNC-101', statut: 'NORMAL' },
  ],
  nb_machines_accessibles: 1,
  cible_ids: { usine: 1, zone: 10, ligne: 100, machine: null },
}

function renderPage() {
  const ctxValue = {
    user: { id: 1, email: 'admin@smartfactory.tn', role: 'ADMIN' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={ctxValue}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

async function ouvrirModalAjout() {
  await userEvent.click(screen.getByRole('button', { name: /ajouter/i }))
  await screen.findByRole('heading', { name: /ajouter un utilisateur/i })
}

async function selectionLigne(valeurLigne = '100') {
  await userEvent.selectOptions(screen.getByLabelText('Usine'), '1')
  await waitFor(() => expect(screen.getByLabelText('Zone / Atelier')).not.toBeDisabled())
  await userEvent.selectOptions(screen.getByLabelText('Zone / Atelier'), '10')
  await waitFor(() => expect(screen.getByLabelText('Ligne de production')).not.toBeDisabled())
  await userEvent.selectOptions(screen.getByLabelText('Ligne de production'), valeurLigne)
}

beforeEach(() => {
  vi.clearAllMocks()
  machineService.getUsines.mockResolvedValue(USINES)
  machineService.getZones.mockResolvedValue(ZONES)
  machineService.getLignes.mockResolvedValue(LIGNES)
  machineService.getMachines.mockResolvedValue([])
  authService.listUsers.mockResolvedValue([EXISTING_USER])
  authService.adminCreateUser.mockResolvedValue({ id: 99 })
  perimetreService.getPerimetres.mockResolvedValue({ count: 0, results: [] })
})

/* ══════════════════════════════════════════════════════════════════════════
   Création avec affectation
   ══════════════════════════════════════════════════════════════════════════ */

describe('UsersPage — création d’un utilisateur avec affectation', () => {
  it('test 1 — crée un OPERATEUR avec une ligne et transmet `perimetres`', async () => {
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalAjout()

    await userEvent.type(screen.getByPlaceholderText('Ali'),   'Ali')
    await userEvent.type(screen.getByPlaceholderText('Benali'), 'Benali')
    await userEvent.type(screen.getByPlaceholderText(/ali\.benali@/), 'ali.benali@sf.tn')

    // La section « Affectation / Périmètre d'accès » est présente.
    expect(screen.getByText(/Affectation \/ Périmètre d.acc.s/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /ajouter une affectation/i }))
    await selectionLigne('100')
    await userEvent.click(screen.getByRole('button', { name: /ajouter l’affectation/i }))

    // L'affectation est listée avant l'enregistrement.
    expect(await screen.findByText('Ligne #100')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /créer et envoyer/i }))

    await waitFor(() => {
      expect(authService.adminCreateUser).toHaveBeenCalledWith(expect.objectContaining({
        role: 'OPERATEUR',
        perimetres: [{ ligne: 100 }],
      }))
    })
  })

  it('test 2 — crée un TECHNICIEN avec plusieurs affectations', async () => {
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalAjout()

    await userEvent.type(screen.getByPlaceholderText('Ali'),   'Yassine')
    await userEvent.type(screen.getByPlaceholderText('Benali'), 'Trabelsi')
    await userEvent.type(screen.getByPlaceholderText(/ali\.benali@/), 'yas.trabelsi@sf.tn')
    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'TECHNICIEN')

    expect(screen.getByText(/Affectation \/ Périmètre d.acc.s/)).toBeInTheDocument()

    // 1ʳᵉ périmètre : niveau Zone
    await userEvent.click(screen.getByRole('button', { name: /ajouter une affectation/i }))
    await userEvent.selectOptions(screen.getByLabelText('Niveau'), 'zone')
    await userEvent.selectOptions(screen.getByLabelText('Usine'), '1')
    await waitFor(() => expect(screen.getByLabelText('Zone / Atelier')).not.toBeDisabled())
    await userEvent.selectOptions(screen.getByLabelText('Zone / Atelier'), '10')
    await userEvent.click(screen.getByRole('button', { name: /ajouter l’affectation/i }))
    await waitFor(() => expect(screen.getByText('Zone #10')).toBeInTheDocument())

    // 2ᵉ périmètre : niveau Ligne (autre ligne)
    await userEvent.click(screen.getByRole('button', { name: /ajouter une affectation/i }))
    await selectionLigne('200')
    await userEvent.click(screen.getByRole('button', { name: /ajouter l’affectation/i }))
    await waitFor(() => expect(screen.getByText('Ligne #200')).toBeInTheDocument())

    // Les deux périmètres coexistent.
    expect(screen.getByText('Zone #10')).toBeInTheDocument()
    expect(screen.getByText('Ligne #200')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /créer et envoyer/i }))

    await waitFor(() => {
      expect(authService.adminCreateUser).toHaveBeenCalledWith(expect.objectContaining({
        role: 'TECHNICIEN',
        perimetres: [{ zone: 10 }, { ligne: 200 }],
      }))
    })
  })

  it('permet de retirer une affectation avant enregistrement', async () => {
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalAjout()

    await userEvent.click(screen.getByRole('button', { name: /ajouter une affectation/i }))
    await selectionLigne('100')
    await userEvent.click(screen.getByRole('button', { name: /ajouter l’affectation/i }))
    await waitFor(() => expect(screen.getByText('Ligne #100')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /retirer ligne #100/i }))

    expect(screen.queryByText('Ligne #100')).not.toBeInTheDocument()
    expect(screen.getByText('Aucune affectation sélectionnée.')).toBeInTheDocument()
  })

  it('refuse une affectation en double', async () => {
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalAjout()

    await userEvent.click(screen.getByRole('button', { name: /ajouter une affectation/i }))
    await selectionLigne('100')
    await userEvent.click(screen.getByRole('button', { name: /ajouter l’affectation/i }))
    await waitFor(() => expect(screen.getByText('Ligne #100')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /ajouter une affectation/i }))
    await selectionLigne('100')
    await userEvent.click(screen.getByRole('button', { name: /ajouter l’affectation/i }))

    expect(await screen.findByText('Cette affectation existe déjà.')).toBeInTheDocument()
  })

  it('test 7 — alerte qu’un OPERATEUR sans affectation n’a accès à aucune machine', async () => {
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalAjout()

    expect(screen.getByText('Aucune affectation sélectionnée.')).toBeInTheDocument()
    expect(
      screen.getByText('Sans affectation, cet opérateur n\'aura accès à aucune machine.')
    ).toBeInTheDocument()
  })

  it('adapte l’avertissement « aucun accès » au rôle (fail-closed)', async () => {
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalAjout()

    expect(
      screen.getByText('Sans affectation, cet opérateur n\'aura accès à aucune machine.')
    ).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'TECHNICIEN')
    expect(
      screen.getByText('Sans affectation, cet technicien n\'aura accès à aucune machine.')
    ).toBeInTheDocument()
  })

it('masque l’avertissement dès qu’une affectation est sélectionnée', async () => {
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalAjout()

    await userEvent.click(screen.getByRole('button', { name: /ajouter une affectation/i }))
    await selectionLigne('100')
    await userEvent.click(screen.getByRole('button', { name: /ajouter l’affectation/i }))
    await screen.findByText('Ligne #100')

    expect(
      screen.queryByText(/n'aura accès à aucune machine/)
    ).not.toBeInTheDocument()
  })

  it('crée un utilisateur sans affectation (liste vide)', async () => {
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalAjout()

    await userEvent.type(screen.getByPlaceholderText('Ali'),   'Sami')
    await userEvent.type(screen.getByPlaceholderText('Benali'), 'Khelifi')
    await userEvent.type(screen.getByPlaceholderText(/ali\.benali@/), 'sami.k@sf.tn')
    await userEvent.click(screen.getByRole('button', { name: /créer et envoyer/i }))

    await waitFor(() => {
      expect(authService.adminCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ perimetres: [] })
      )
    })
  })

  it('affiche le message de succès de création', async () => {
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalAjout()

    await userEvent.type(screen.getByPlaceholderText('Ali'),   'Sami')
    await userEvent.type(screen.getByPlaceholderText('Benali'), 'Khelifi')
    await userEvent.type(screen.getByPlaceholderText(/ali\.benali@/), 'sami.k@sf.tn')
    await userEvent.click(screen.getByRole('button', { name: /créer et envoyer/i }))

    expect(await screen.findByText(/Utilisateur créé avec succès/)).toBeInTheDocument()
  })

  it('remonte l’erreur API sur les affectations', async () => {
    authService.adminCreateUser.mockRejectedValue({
      response: { data: { perimetres: ['Affectation #1 : ligne : Objet introuvable.'] } },
    })
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalAjout()

    await userEvent.type(screen.getByPlaceholderText('Ali'),   'Ali')
    await userEvent.type(screen.getByPlaceholderText('Benali'), 'Benali')
    await userEvent.type(screen.getByPlaceholderText(/ali\.benali@/), 'ali.b@sf.tn')
    await userEvent.click(screen.getByRole('button', { name: /créer et envoyer/i }))

    expect(
      await screen.findByText('Affectation #1 : ligne : Objet introuvable.')
    ).toBeInTheDocument()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   Modification
   ══════════════════════════════════════════════════════════════════════════ */

describe('UsersPage — modification des affectations', () => {
  async function ouvrirModalEdition() {
    await userEvent.click(screen.getByRole('button', { name: /^modifier$/i }))
    await screen.findByRole('heading', { name: /modifier l'utilisateur/i })
  }

  it('test 3 — affiche les affectations existantes dans « Modifier »', async () => {
    perimetreService.getPerimetres.mockResolvedValue({
      count: 1, results: [SCOPE_EXISTANTE],
    })
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalEdition()

    expect(await screen.findByText('Affectations')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(SCOPE_EXISTANTE.libelle)).toBeInTheDocument()
    })
    expect(perimetreService.getPerimetres).toHaveBeenCalledWith({ utilisateur: 46 })
  })

  it('test 3 — permet d’ajouter une affectation via l’API UserScope', async () => {
    perimetreService.getPerimetres.mockResolvedValue({
      count: 1, results: [SCOPE_EXISTANTE],
    })
    perimetreService.createPerimetre.mockResolvedValue(SCOPE_EXISTANTE)
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalEdition()
    await waitFor(() => expect(screen.getByText(SCOPE_EXISTANTE.libelle)).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /ajouter une affectation/i }))
    await userEvent.selectOptions(screen.getByLabelText('Niveau'), 'zone')
    await userEvent.selectOptions(screen.getByLabelText('Usine'), '1')
    await waitFor(() => expect(screen.getByLabelText('Zone / Atelier')).not.toBeDisabled())
    await userEvent.selectOptions(screen.getByLabelText('Zone / Atelier'), '10')
    await userEvent.click(screen.getByRole('button', { name: /^enregistrer l.affectation$/i }))

    await waitFor(() => {
      expect(perimetreService.createPerimetre).toHaveBeenCalledWith({
        utilisateur: 46, zone: 10,
      })
    })
    expect(await screen.findByText('Affectation ajoutée avec succès.')).toBeInTheDocument()
  })

  it('test 3 — permet de modifier une affectation via PATCH', async () => {
    perimetreService.getPerimetres.mockResolvedValue({
      count: 1, results: [SCOPE_EXISTANTE],
    })
    perimetreService.updatePerimetre.mockResolvedValue(SCOPE_EXISTANTE)
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalEdition()
    await waitFor(() => expect(screen.getByText(SCOPE_EXISTANTE.libelle)).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /^Modifier / }))
    await waitFor(() => expect(screen.getByLabelText('Usine')).toHaveValue('1'))
    await userEvent.selectOptions(screen.getByLabelText('Ligne de production'), '200')
    await userEvent.click(screen.getByRole('button', { name: /^enregistrer l.affectation$/i }))

    await waitFor(() => {
      expect(perimetreService.updatePerimetre).toHaveBeenCalledWith(7, {
        usine: null, zone: null, ligne: 200, machine: null,
      })
    })
    expect(await screen.findByText('Affectation modifiée avec succès.')).toBeInTheDocument()
  })

  it('test 4 — permet de supprimer une affectation après confirmation', async () => {
    perimetreService.getPerimetres.mockResolvedValue({
      count: 1, results: [SCOPE_EXISTANTE],
    })
    perimetreService.deletePerimetre.mockResolvedValue(null)
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalEdition()
    await waitFor(() => expect(screen.getByText(SCOPE_EXISTANTE.libelle)).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^Supprimer ${SCOPE_EXISTANTE.libelle}`) }))
    // Confirmation obligatoire avant suppression.
    expect(perimetreService.deletePerimetre).not.toHaveBeenCalled()

    await userEvent.click(within(screen.getByRole('group', { name: 'Confirmation de suppression' })).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => {
      expect(perimetreService.deletePerimetre).toHaveBeenCalledWith(7)
    })
    expect(await screen.findByText('Affectation supprimée avec succès.')).toBeInTheDocument()
  })

  it('test 7 — affiche « Aucune affectation configurée. » si l’utilisateur n’en a pas', async () => {
    perimetreService.getPerimetres.mockResolvedValue({ count: 0, results: [] })
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalEdition()

    expect(
      await screen.findByText('Aucune affectation configurée.')
    ).toBeInTheDocument()
  })

  it('test 6 — un ADMIN n’a pas de section d’affectation', async () => {
    authService.listUsers.mockResolvedValue([
      { ...EXISTING_USER, id: 1, role: 'ADMIN', email: 'admin@sf.tn' },
    ])
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalEdition()

    expect(screen.getByText(/accès global/)).toBeInTheDocument()
    expect(screen.queryByText('Affectations')).not.toBeInTheDocument()
    // Aucune requête d'affectation n'est émise pour un ADMIN.
    expect(perimetreService.getPerimetres).not.toHaveBeenCalled()
  })

  it('bascule la section selon le rôle sélectionné', async () => {
    // Un ADMIN n'a pas d'affectation ; on vérifie que le passage du rôle
    // à OPERATEUR fait apparaître la section.
    authService.listUsers.mockResolvedValue([
      { ...EXISTING_USER, id: 1, role: 'ADMIN', email: 'admin@sf.tn' },
    ])
    perimetreService.getPerimetres.mockResolvedValue({ count: 0, results: [] })
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())
    await ouvrirModalEdition()

    expect(screen.queryByText('Affectations')).not.toBeInTheDocument()
    expect(screen.getByText(/accès global/)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'OPERATEUR')

    expect(await screen.findByText('Affectations')).toBeInTheDocument()
    expect(screen.queryByText(/accès global/)).not.toBeInTheDocument()
    await waitFor(() => expect(perimetreService.getPerimetres).toHaveBeenCalledWith({ utilisateur: 1 }))
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   Détail utilisateur — lecture seule
   ══════════════════════════════════════════════════════════════════════════ */

describe('UsersPage — détail utilisateur', () => {
  it('affiche le périmètre en lecture seule', async () => {
    perimetreService.getPerimetres.mockResolvedValue({
      count: 1, results: [SCOPE_EXISTANTE],
    })
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())

    await userEvent.click(screen.getByRole('button', { name: /voir les détails/i }))
    await screen.findByRole('heading', { name: /détails utilisateur/i })

    expect(await screen.findByText(/Périmètre d.acc.s/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(SCOPE_EXISTANTE.libelle)).toBeInTheDocument()
    })
    // Aucun contrôle d'écriture.
    expect(screen.queryByRole('button', { name: /ajouter une affectation/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Modifier / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Supprimer / })).not.toBeInTheDocument()
  })

  it('indique l’accès global pour un ADMIN', async () => {
    authService.listUsers.mockResolvedValue([
      { ...EXISTING_USER, id: 1, role: 'ADMIN', email: 'admin@sf.tn' },
    ])
    renderPage()
    await waitFor(() => expect(authService.listUsers).toHaveBeenCalled())

    await userEvent.click(screen.getByRole('button', { name: /voir les détails/i }))
    expect(await screen.findByText(/Accès global — aucune affectation requise/)).toBeInTheDocument()
    expect(perimetreService.getPerimetres).not.toHaveBeenCalled()
  })
})