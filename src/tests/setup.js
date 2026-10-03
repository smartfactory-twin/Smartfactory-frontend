import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

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

// ── API navigateur manquante dans jsdom (prévisualisation des images) ──────────
window.URL.createObjectURL = vi.fn(() => 'blob:preview')
window.URL.revokeObjectURL = vi.fn()

// ── Reset mocks entre chaque test ─────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
