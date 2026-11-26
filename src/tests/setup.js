import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Isole les tests d'interface du backend; les tests de notifications définissent leur propre réponse.
vi.mock('../services/notificationService', () => ({
  getNotifications: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  getNotificationCount: vi.fn().mockResolvedValue({ non_lues: 0 }),
  markAsRead: vi.fn().mockResolvedValue({}),
  markAllAsRead: vi.fn().mockResolvedValue({}),
}))

// ── Mock localStorage ─────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store = {}
  return {
    getItem:    (key)        => store[key] ?? null,
    setItem:    (key, value) => { store[key] = String(value) },
    removeItem: (key)        => { delete store[key] },
    clear:      ()           => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Suit la largeur de l'écran pour adapter la navigation.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })),
})

// ── API navigateur manquante dans jsdom (prévisualisation des images) ──────────
window.URL.createObjectURL = vi.fn(() => 'blob:preview')
window.URL.revokeObjectURL = vi.fn()

// ── Reset mocks entre chaque test ─────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
