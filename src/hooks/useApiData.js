import { useState, useEffect, useCallback } from 'react'

/**
 * Hook générique pour charger des données depuis une fonction API.
 * Gère les états loading / data / error.
 * Si l'API retourne 404 (endpoint non implémenté), data reste null sans crasher.
 *
 * @param {Function} fetchFn  - fonction async qui retourne les données
 * @param {Array}    deps     - dépendances pour re-déclencher le fetch
 */
export function useApiData(fetchFn, deps = []) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchFn()
      setData(result)
    } catch (err) {
      const status = err.response?.status
      // 404 = endpoint pas encore créé → pas une vraie erreur pour l'UI
      if (status === 404) {
        setData(null)
      } else {
        setError(err.response?.data?.detail || 'Erreur de chargement.')
      }
    } finally {
      setLoading(false)
    }
  }, deps) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}
