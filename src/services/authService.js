import api from './api'

/**
 * POST /auth/login/
 * Retourne { access, refresh, user } ou { must_reset_password, uid, token, detail }
 */
export const login = async (email, password) => {
  const { data } = await api.post('/auth/login/', { email, password })
  return data
}

/**
 * POST /auth/logout/
 * Invalide le refresh token (blacklist)
 */
export const logout = async (refreshToken) => {
  const { data } = await api.post('/auth/logout/', { refresh: refreshToken })
  return data
}

/**
 * POST /auth/register/
 */
export const register = async (payload) => {
  const { data } = await api.post('/auth/register/', payload)
  return data
}

/**
 * POST /auth/token/refresh/
 */
export const refreshToken = async (refresh) => {
  const { data } = await api.post('/auth/token/refresh/', { refresh })
  return data
}

/**
 * GET /auth/me/
 * Retourne le profil de l'utilisateur connecté
 */
export const getMe = async () => {
  const { data } = await api.get('/auth/me/')
  return data
}

/**
 * POST /auth/password-reset/
 * Répond toujours 200 (pas d'énumération de comptes)
 */
export const passwordReset = async (email) => {
  const { data } = await api.post('/auth/password-reset/', { email })
  return data
}

/**
 * POST /auth/password-reset/confirm/
 */
export const passwordResetConfirm = async (uid, token, new_password, new_password_confirm) => {
  const { data } = await api.post('/auth/password-reset/confirm/', {
    uid,
    token,
    new_password,
    new_password_confirm,
  })
  return data
}

/**
 * DELETE /auth/users/:id/delete/  (ADMIN seulement)
 */
export const deleteUser = async (id) => {
  await api.delete(`/auth/users/${id}/delete/`)
}

/**
 * PATCH /auth/users/:id/update/  (ADMIN seulement)
 * Modifie le rôle, le statut actif, nom, prénom
 */
export const updateUserAdmin = async (id, data) => {
  const res = await api.patch(`/auth/users/${id}/update/`, data)
  return res.data
}

/**
 * GET /auth/users/list/  (ADMIN seulement)
 * Liste paginée des utilisateurs avec filtres optionnels
 * @param {Object} params - search, role, actif, ordering, page
 */
export const listUsers = async (params = {}) => {
  const { data } = await api.get('/auth/users/list/', { params })
  return data
}

/**
 * POST /auth/users/  (ADMIN seulement)
 * Crée un utilisateur et lui envoie ses credentials par email
 */
export const adminCreateUser = async (payload) => {
  const { data } = await api.post('/auth/users/', payload)
  return data
}

/**
 * POST /auth/password-reset/confirm/  — utilisé aussi pour changer le mot de passe
 * depuis le profil (on utilise le même flux uid+token généré depuis /password-reset/)
 * Pour un changement "connecté", on passe par password-reset + confirm.
 */
export const changePassword = async (uid, token, new_password, new_password_confirm) => {
  return passwordResetConfirm(uid, token, new_password, new_password_confirm)
}
