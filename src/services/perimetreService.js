import api from './api'

/**
 * Service des périmètres d'accès (UserScope).
 *
 * Le backend reste la source de vérité de la sécurité : ces endpoints
 * exposent les affectations et le périmètre RÉELLEMENT appliqué
 * (`mon-perimetre` s'appuie sur `accessible_machine_ids`).
 * Aucune décision d'accès n'est prise ici.
 */

export const NIVEAUX = [
  { value: 'ligne',   label: 'Ligne de production', hint: 'Les machines de la ligne' },
  { value: 'zone',    label: 'Zone / Atelier',      hint: "Toutes les lignes de l'atelier" },
  { value: 'usine',   label: 'Usine',               hint: "Tout le site de l'usine" },
  { value: 'machine', label: 'Machine',             hint: 'Une seule machine' },
]

/**
 * GET /equipements/perimetres/
 * ADMIN : tous les périmètres (filtre optionnel `?utilisateur=<id>`)
 * OPERATEUR / TECHNICIEN : ses propres affectations uniquement
 */
export const getPerimetres = (params = {}) =>
  api.get('/equipements/perimetres/', { params }).then(r => r.data)

/**
 * GET /equipements/perimetres/mon-perimetre/
 * Périmètre résolu de l'utilisateur connecté :
 * { role, acces_global, nb_machines_accessibles, machines[], affectations[] }
 */
export const getMonPerimetre = () =>
  api.get('/equipements/perimetres/mon-perimetre/').then(r => r.data)

/** POST /equipements/perimetres/ — ADMIN uniquement */
export const createPerimetre = (payload) =>
  api.post('/equipements/perimetres/', payload).then(r => r.data)

/** PATCH /equipements/perimetres/:id/ — ADMIN uniquement */
export const updatePerimetre = (id, payload) =>
  api.patch(`/equipements/perimetres/${id}/`, payload).then(r => r.data)

/** DELETE /equipements/perimetres/:id/ — ADMIN uniquement */
export const deletePerimetre = (id) =>
  api.delete(`/equipements/perimetres/${id}/`).then(r => r.data)