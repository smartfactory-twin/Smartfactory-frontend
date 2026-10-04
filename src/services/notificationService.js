import api from './api'

export const getNotifications = async (params = {}) => {
  const { data } = await api.get('/notifications/', { params })
  return data
}

export const getNotificationCount = async () => {
  const { data } = await api.get('/notifications/compteur/')
  return data
}

export const markAsRead = async (id) => {
  const { data } = await api.post(`/notifications/${id}/lire/`)
  window.dispatchEvent(new Event('notifications-updated'))
  return data
}

export const markAllAsRead = async () => {
  const { data } = await api.post('/notifications/tout-lire/')
  window.dispatchEvent(new Event('notifications-updated'))
  return data
}
