import { useState, useEffect, useCallback, useRef } from 'react'
import { Building2, Layers, GitBranch, Cpu, Plus, Trash2, Pencil, Loader2, Info, ShieldCheck } from 'lucide-react'
import Alert from '../common/Alert'
import Button from '../common/Button'
import { getUsines, getZones, getLignes, getMachines } from '../../services/machineService'
import {
  getPerimetres, createPerimetre, updatePerimetre, deletePerimetre, NIVEAUX,
} from '../../services/perimetreService'

const NIVEAU_ICON  = { usine: Building2, zone: Layers, ligne: GitBranch, machine: Cpu }
const NIVEAU_LIBELLE = { usine: 'Usine', zone: 'Zone', ligne: 'Ligne', machine: 'Machine' }

const EMPTY = { niveau: 'ligne', usine: '', zone: '', ligne: '', machine: '' }

/** Reconstruit une sélection `HierarchyPicker` depuis un objet API. */
function selectionDepuisScope(scope) {
  const ids = scope.cible_ids ?? {}
  return {
    niveau: scope.niveau ?? 'ligne',
    usine:   ids.usine   ?? scope.usine   ?? '',
    zone:    ids.zone    ?? scope.zone    ?? '',
    ligne:   ids.ligne   ?? scope.ligne   ?? '',
    machine: ids.machine ?? scope.machine ?? '',
  }
}

/** Sérialise une sélection du picker en payload `perimetres` (UN seul niveau). */
export function selectionVersPayload(sel) {
  if (!sel) return null
  if (sel.niveau === 'usine'   && sel.usine)   return { usine: Number(sel.usine) }
  if (sel.niveau === 'zone'    && sel.zone)    return { zone: Number(sel.zone) }
  if (sel.niveau === 'ligne'   && sel.ligne)   return { ligne: Number(sel.ligne) }
  if (sel.niveau === 'machine' && sel.machine) return { machine: Number(sel.machine) }
  return null
}

const cle = (a) =>
  `${a.usine ?? ''}|${a.zone ?? ''}|${a.ligne ?? ''}|${a.machine ?? ''}`

/**
 * Sélecteur hiérarchique : Usine → Zone → Ligne → Machine.
 *
 * Les sélections sont cohérentes par construction :
 *  - choisir une usine recharge les zones et réinitialise zone/ligne/machine ;
 *  - choisir une zone recharge les lignes et réinitialise ligne/machine ;
 *  - choisir une ligne charge ses machines.
 *
 * On ne peut donc jamais produire de combinaison incohérente.
 */
export function HierarchyPicker({ value, onChange, idPrefix = 'scope' }) {
  const [usines, setUsines]             = useState([])
  const [zones, setZones]               = useState([])
  const [lignes, setLignes]             = useState([])
  const [machines, setMachines]         = useState([])
  const [loadingMachines, setLoadingMachines] = useState(false)
  const [loadError, setLoadError]       = useState(null)

  const { niveau, usine, zone, ligne, machine } = value

  // Usines — chargé une seule fois.
  useEffect(() => {
    let active = true
    getUsines({ page_size: 200 })
      .then(d => { if (active) setUsines(d.results ?? d) })
      .catch(() => { if (active) setUsines([]) })
    return () => { active = false }
  }, [])

  // Zones de l'usine choisie.
  useEffect(() => {
    if (!usine) { setZones([]); return }
    let active = true
    getZones({ usine, page_size: 200 })
      .then(d => { if (active) setZones(d.results ?? d) })
      .catch(() => { if (active) setZones([]) })
    return () => { active = false }
  }, [usine])

  // Lignes de la zone choisie.
  useEffect(() => {
    if (!zone) { setLignes([]); return }
    let active = true
    getLignes({ zone, page_size: 200 })
      .then(d => { if (active) setLignes(d.results ?? d) })
      .catch(() => { if (active) setLignes([]) })
    return () => { active = false }
  }, [zone])

  // Machines de la ligne choisie — uniquement au niveau « machine ».
  useEffect(() => {
    if (niveau !== 'machine' || !ligne) { setMachines([]); return }
    let active = true
    setLoadingMachines(true)
    setLoadError(null)
    getMachines({ ligne_production: ligne, page_size: 200 })
      .then(d => { if (active) setMachines(d.results ?? d) })
      .catch(() => {
        if (active) { setMachines([]); setLoadError('Impossible de charger les machines.') }
      })
      .finally(() => { if (active) setLoadingMachines(false) })
    return () => { active = false }
  }, [niveau, ligne])

  // Changer de niveau : on ne conserve que ce qui garde du sens.
  const changeNiveau = (n) => {
    if (n === 'usine')   onChange({ ...EMPTY, niveau: n, usine })
    if (n === 'zone')    onChange({ ...EMPTY, niveau: n, usine, zone })
    if (n === 'ligne')   onChange({ ...EMPTY, niveau: n, usine, zone, ligne })
    if (n === 'machine') onChange({ ...EMPTY, niveau: n, usine, zone, ligne, machine })
  }

  // Sélection : réinitialise les niveaux descendants.
  const select = (patch) => {
    const next = { ...value, ...patch }
    if ('usine' in patch) { next.zone = ''; next.ligne = ''; next.machine = '' }
    if ('zone'  in patch) { next.ligne = ''; next.machine = '' }
    if ('ligne' in patch) { next.machine = '' }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-niveau`} className="block text-xs font-medium text-gray-700 mb-1.5">
          Niveau
        </label>
        <select
          id={`${idPrefix}-niveau`}
          className="input-field text-sm"
          value={niveau}
          onChange={e => changeNiveau(e.target.value)}
        >
          {NIVEAUX.map(n => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-usine`} className="block text-xs font-medium text-gray-700 mb-1.5">
          Usine
        </label>
        <select
          id={`${idPrefix}-usine`}
          className="input-field text-sm"
          value={usine}
          onChange={e => select({ usine: e.target.value })}
        >
          <option value="">— Toutes les usines —</option>
          {usines.map(u => <option key={u.id} value={u.id}>{u.nom}</option>)}
        </select>
      </div>

      {niveau !== 'usine' && (
        <div>
          <label htmlFor={`${idPrefix}-zone`} className="block text-xs font-medium text-gray-700 mb-1.5">
            Zone / Atelier
          </label>
          <select
            id={`${idPrefix}-zone`}
            className="input-field text-sm"
            value={zone}
            disabled={!usine}
            onChange={e => select({ zone: e.target.value })}
          >
            <option value="">
              {usine ? '— Toutes les zones —' : 'Choisissez d’abord une usine'}
            </option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}
          </select>
        </div>
      )}

      {(niveau === 'ligne' || niveau === 'machine') && (
        <div>
          <label htmlFor={`${idPrefix}-ligne`} className="block text-xs font-medium text-gray-700 mb-1.5">
            Ligne de production
          </label>
          <select
            id={`${idPrefix}-ligne`}
            className="input-field text-sm"
            value={ligne}
            disabled={!zone}
            onChange={e => select({ ligne: e.target.value })}
          >
            <option value="">
              {zone ? '— Toutes les lignes —' : 'Choisissez d’abord une zone'}
            </option>
            {lignes.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
          </select>
        </div>
      )}

      {niveau === 'machine' && (
        <div>
          <label htmlFor={`${idPrefix}-machine`} className="block text-xs font-medium text-gray-700 mb-1.5">
            Machine
          </label>
          <select
            id={`${idPrefix}-machine`}
            className="input-field text-sm"
            value={machine}
            disabled={!ligne || loadingMachines}
            onChange={e => select({ machine: e.target.value })}
          >
            <option value="">
              {loadingMachines ? 'Chargement…'
                : ligne ? '— Choisir une machine —'
                : 'Choisissez d’abord une ligne'}
            </option>
            {machines.map(m => (
              <option key={m.id} value={m.id}>{m.identifiant_interne} — {m.nom}</option>
            ))}
          </select>
        </div>
      )}

      {loadError && <Alert type="warning" message={loadError} />}
    </div>
  )
}

/**
 * Gestionnaire d'affectations d'un utilisateur (ADMIN).
 *
 * Les écritures passent par l'API `UserScope` : le backend reste la source
 * de vérité de la sécurité, le frontend ne fait que la CRUD d'affectation.
 *
 * @param utilisateurId  id de l'utilisateur concerné
 * @param onChange       appelé après chaque affectation créée / modifiée / supprimée
 */
export default function ScopeManager({ utilisateurId, onChange, readOnly = false }) {
  const [affectations, setAffectations] = useState([])
  const [loading, setLoading]           = useState(true)
  const [loadingScope, setLoadingScope] = useState(false)
  const [editing, setEditing]           = useState(null) // null | 'new' | id
  const [draft, setDraft]               = useState(EMPTY)
  const [erreur, setErreur]             = useState(null)
  const [flash, setFlash]               = useState(null) // { type, message, id }
  const [confirmDelete, setConfirmDelete] = useState(null)

  // `Alert` se masque définitivement une fois fermé : la clé `id` force un
  // remontage pour qu'un message identique puisse être ré-affiché.
  const flashSeq = useRef(0)
  const notify = useCallback((type, message) =>
    setFlash({ type, message, id: ++flashSeq.current }), [])

  const fetchScopes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPerimetres({ utilisateur: utilisateurId })
      setAffectations(data.results ?? data)
    } catch {
      notify('error', 'Impossible de charger les affectations.')
    } finally { setLoading(false) }
  }, [utilisateurId, notify])

  useEffect(() => { fetchScopes() }, [fetchScopes])

  const reset = () => { setEditing(null); setDraft(EMPTY); setErreur(null) }

  const startEdit = (scope) => {
    setErreur(null)
    setDraft(selectionDepuisScope(scope))
    setEditing(scope.id)
  }

  const enregistrer = async () => {
    const payload = selectionVersPayload(draft)
    if (!payload) { setErreur('Sélectionnez un élément à affecter.'); return }

    // Pas de doublon sur une autre affectation.
    const autres = affectations.filter(a => a.id !== editing)
    if (autres.some(a => cle(a) === cle(payload))) {
      setErreur('Cette affectation existe déjà.')
      return
    }

    setLoadingScope(true); setErreur(null)
    try {
      if (editing === 'new') {
        await createPerimetre({ utilisateur: utilisateurId, ...payload })
        notify('success', 'Affectation ajoutée avec succès.')
      } else {
        // On repart d'une affectation viergée avant d'appliquer la nouvelle
        // cible, pour ne pas conserver deux niveaux.
        await updatePerimetre(editing, { usine: null, zone: null, ligne: null, machine: null, ...payload })
        notify('success', 'Affectation modifiée avec succès.')
      }
      reset()
      await fetchScopes()
      onChange?.()
    } catch (err) {
      const d = err?.response?.data
      const msg = typeof d === 'string' ? d
        : Array.isArray(d?.non_field_errors) ? d.non_field_errors[0]
        : Object.values(d ?? {})[0]?.[0] ?? 'Erreur lors de l’enregistrement.'
      notify('error', msg)
    } finally { setLoadingScope(false) }
  }

  const supprimer = async (scope) => {
    setLoadingScope(true); setErreur(null)
    try {
      await deletePerimetre(scope.id)
      setConfirmDelete(null)
      notify('success', 'Affectation supprimée avec succès.')
      await fetchScopes()
      onChange?.()
    } catch (err) {
      setConfirmDelete(null)
      notify('error', err?.response?.data?.detail ?? 'Erreur lors de la suppression.')
    } finally { setLoadingScope(false) }
  }

  return (
    <div className="space-y-3">
      {flash && (
        <Alert key={flash.id} type={flash.type} message={flash.message} dismissible />
      )}
      {erreur && <Alert key={erreur} type="error" message={erreur} />}

      {loading ? (
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Chargement des affectations…</p>
        </div>
      ) : affectations.length === 0 ? (
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
          <Info className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <p className="text-sm text-gray-500">Aucune affectation configurée.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {affectations.map(a => {
            const Icon = NIVEAU_ICON[a.niveau] ?? ShieldCheck
            return (
              <li key={a.id} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                <Icon className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{a.libelle}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-gray-500">{NIVEAU_LIBELLE[a.niveau]}</span>
                    {a.nb_machines_accessibles != null && (
                      <span className="text-xs text-gray-500">
                        {a.nb_machines_accessibles} machine(s) accessible(s)
                      </span>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      disabled={loadingScope}
                      title="Modifier"
                      aria-label={`Modifier ${a.libelle}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setConfirmDelete(a); setErreur(null) }}
                      disabled={loadingScope}
                      title="Supprimer"
                      aria-label={`Supprimer ${a.libelle}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Confirmation avant suppression */}
      {confirmDelete && (
        <div
          role="group"
          aria-label="Confirmation de suppression"
          className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg"
        >
          <Trash2 className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">
              Supprimer l’affectation <strong>{confirmDelete.libelle}</strong> ?
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              L’utilisateur perdra l’accès aux machines correspondantes.
            </p>
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)} disabled={loadingScope}>
                Annuler
              </Button>
              <Button variant="danger" size="sm" onClick={() => supprimer(confirmDelete)} loading={loadingScope}>
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire d'ajout / modification */}
      {!readOnly && (editing ? (
        <div className="p-3 border border-primary-200 bg-primary-50/30 rounded-lg space-y-3">
          <p className="text-sm font-semibold text-gray-800">
            {editing === 'new' ? 'Nouvelle affectation' : 'Modifier l’affectation'}
          </p>
          <HierarchyPicker value={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={reset} disabled={loadingScope}>Annuler</Button>
            <Button size="sm" onClick={enregistrer} loading={loadingScope}>Enregistrer l’affectation</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => { setEditing('new'); setDraft(EMPTY); setErreur(null) }}>
          <Plus className="h-4 w-4" /> Ajouter une affectation
        </Button>
      ))}
    </div>
  )
}