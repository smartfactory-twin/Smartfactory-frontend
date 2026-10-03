import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as loginService, logout as logoutService, getMe } from '../services/authService'

// Export nommé pour les tests (AuthContext.Provider dans les mocks)
export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]              = useState(null)
  const [isAuthenticated, setIsAuth] = useState(false)
  const [isLoading, setIsLoading]    = useState(true)

  // Re-hydrate depuis localStorage au montage (refresh de page)
  useEffect(() => {
    const access = localStorage.getItem('sf_access')
    if (access) {
      getMe()
        .then((data) => {
          setUser(data)
          setIsAuth(true)
        })
        .catch(() => {
          localStorage.removeItem('sf_access')
          localStorage.removeItem('sf_refresh')
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await loginService(email, password)

    // Cas forced reset (premier login admin-created)
    if (data.must_reset_password) {
      return { mustReset: true, uid: data.uid, token: data.token }
    }

    // Stocker les tokens
    localStorage.setItem('sf_access', data.access)
    localStorage.setItem('sf_refresh', data.refresh)

    // Charger le profil COMPLET via GET /auth/me/
    // (la réponse du login ne contient que les claims JWT — sans photo ni telephone)
    const fullUser = await getMe()
    setUser(fullUser)
    setIsAuth(true)
    return { mustReset: false, role: fullUser.role }
  }, [])

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('sf_refresh')
    try {
      if (refresh) await logoutService(refresh)
    } catch (_) {
      // Déconnexion côté client même si le serveur échoue
    } finally {
      localStorage.removeItem('sf_access')
      localStorage.removeItem('sf_refresh')
      setUser(null)
      setIsAuth(false)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const data = await getMe()
    setUser(data)
    return data
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
