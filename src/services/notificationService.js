import api from './api'

/**
 * GET /notifications/  — notifications de l'utilisateur connecté
 * Backend non encore implémenté (Sprint 2+).
 */
export const getNotifications = async (params = {}) => {
  const { data } = await api.get('/notifications/', { params })
  return data
}

export const markAsRead = async (id) => {
  const { data } = await api.patch(`/notifications/${id}/`, { lu: true })
  return data
}
