import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }))
import api from '../../services/api'
import { loginWithGoogle } from '../../services/authService'

describe('authService Google login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envoie le credential à POST /auth/google-login/', async () => {
    const result = { access: 'access-test', refresh: 'refresh-test', user: { id: 8, role: 'TECHNICIEN' } }
    api.post.mockResolvedValue({ data: result })
    await expect(loginWithGoogle('credential-test')).resolves.toEqual(result)
    expect(api.post).toHaveBeenCalledWith('/auth/google-login/', { credential: 'credential-test' })
  })
})
