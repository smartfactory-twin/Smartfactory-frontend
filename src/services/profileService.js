import api from './api'

/**
 * PATCH /auth/me/update/
 * Met à jour nom, prénom, téléphone et/ou photo de l'utilisateur connecté.
 * Accepte un objet plain ou un FormData (si photo incluse).
 */
export const updateProfile = async (payload) => {
  const isFormData = payload instanceof FormData
  const { data } = await api.patch('/auth/me/update/', payload, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
  })
  return data
}

/**
 * POST /auth/me/change-password/
 * Change le mot de passe directement (sans token email).
 * @param {{ current_password: string, new_password: string, new_password_confirm: string }} payload
 */
export const changePassword = async (payload) => {
  const { data } = await api.post('/auth/me/change-password/', payload)
  return data
}
