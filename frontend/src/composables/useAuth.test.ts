/**
 * Tests for the `useAuth` composable.
 *
 * Contract under test: `useAuth()` returns a `readonly(reactive(...))`
 * object. State fields (isAuthenticated, setupRequired, loading, error)
 * are accessible as **unwrapped** values — the same surface that
 * templates see and that JS consumers should use. Methods (login,
 * logout, setup, retryStatus) are unchanged: plain functions.
 *
 * Uses isolation strategy: each test does vi.resetModules() then
 * dynamically imports useAuth.js so the module-level singleton state
 * is fresh per test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthStatus } from '../types/index.js'

// Mock api module - hoisted so it's in place for every dynamic import.
const mockAuthStatus = vi.fn()
const mockLogin = vi.fn()
const mockLogout = vi.fn()
const mockSetup = vi.fn()
const mockChangePassword = vi.fn()
const mockOnUnauthorized = vi.fn<(cb: () => void) => () => void>(() => () => {})

vi.mock('../api.js', () => ({
  api: {
    authStatus: mockAuthStatus,
    login: mockLogin,
    logout: mockLogout,
    setup: mockSetup,
    changePassword: mockChangePassword,
  },
  onUnauthorized: mockOnUnauthorized,
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state (before status fetch resolves)', () => {
    it('loading === true, isAuthenticated === false, setupRequired === false, error === null', async () => {
      // Never resolve so the assertion runs synchronously before microtasks drain.
      mockAuthStatus.mockReturnValue(new Promise<AuthStatus>(() => {}))

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      // State is exposed as unwrapped values (reactive unwrap), not Refs.
      expect(typeof auth.loading).toBe('boolean')
      expect(typeof auth.isAuthenticated).toBe('boolean')
      expect(typeof auth.setupRequired).toBe('boolean')
      expect(auth.loading).toBe(true)
      expect(auth.isAuthenticated).toBe(false)
      expect(auth.setupRequired).toBe(false)
      expect(auth.error).toBe(null)
    })
  })

  describe('after mocked api.authStatus() resolves with { setupRequired: true }', () => {
    it('setupRequired === true, loading === false', async () => {
      mockAuthStatus.mockResolvedValue({ setupRequired: true, authenticated: false })

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      // Wait for the initial fetch to complete.
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(auth.setupRequired).toBe(true)
      expect(auth.loading).toBe(false)
      expect(auth.error).toBe(null)
    })
  })

  describe('after mocked api.authStatus() resolves with { setupRequired: false }', () => {
    it('setupRequired === false, loading === false', async () => {
      mockAuthStatus.mockResolvedValue({ setupRequired: false, authenticated: false })

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(auth.setupRequired).toBe(false)
      expect(auth.loading).toBe(false)
      expect(auth.error).toBe(null)
    })

    it('authenticated: true flips isAuthenticated to true without a manual login', async () => {
      // This is the regression test for the "close + reopen tab" bug:
      // when the server reports an existing valid session, the client
      // must mirror that into isAuthenticated on the initial fetch so
      // the user is not prompted to log in again.
      mockAuthStatus.mockResolvedValue({ setupRequired: false, authenticated: true })

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(auth.isAuthenticated).toBe(true)
      expect(auth.setupRequired).toBe(false)
      expect(auth.loading).toBe(false)
    })
  })

  describe('after mocked api.authStatus() rejects', () => {
    it('error is set to a friendly message, loading === false', async () => {
      mockAuthStatus.mockRejectedValue(new Error('Server error'))

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(auth.error).toBe('Server error')
      expect(auth.loading).toBe(false)
    })

    it('network errors get a user-friendly message', async () => {
      const networkError = new TypeError('Failed to fetch')
      mockAuthStatus.mockRejectedValue(networkError)

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(auth.error).toBe("Couldn't reach server. Please check your connection.")
      expect(auth.loading).toBe(false)
    })
  })

  describe('retryStatus()', () => {
    it('re-runs the fetch and clears error on success', async () => {
      // First call fails, second call succeeds.
      mockAuthStatus
        .mockResolvedValueOnce({ setupRequired: false, authenticated: false })  // initial
        .mockResolvedValueOnce({ setupRequired: true, authenticated: false })   // retry

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      // Initial state: setupRequired === false
      expect(auth.setupRequired).toBe(false)
      expect(auth.error).toBe(null)

      // Retry with new result
      await auth.retryStatus()

      expect(auth.setupRequired).toBe(true)
      expect(auth.error).toBe(null)
      expect(mockAuthStatus).toHaveBeenCalledTimes(2)
    })
  })

  describe('login()', () => {
    it('calls api.login and flips isAuthenticated to true on success', async () => {
      mockAuthStatus.mockResolvedValue({ setupRequired: false, authenticated: false })
      mockLogin.mockResolvedValue({ success: true })

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(auth.isAuthenticated).toBe(false)

      await auth.login('secret123')

      expect(mockLogin).toHaveBeenCalledWith('secret123')
      expect(auth.isAuthenticated).toBe(true)
    })

    it('re-throws on api.login rejection; isAuthenticated stays false', async () => {
      mockAuthStatus.mockResolvedValue({ setupRequired: false, authenticated: false })
      mockLogin.mockRejectedValue(new Error('Incorrect password'))

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      await expect(auth.login('wrong')).rejects.toThrow('Incorrect password')
      expect(auth.isAuthenticated).toBe(false)
    })
  })

  describe('logout()', () => {
    it('calls api.logout and flips isAuthenticated AND setupRequired to false', async () => {
      // Need to use .mockResolvedValueOnce chain to handle initial authStatus call + retry
      mockAuthStatus.mockResolvedValue({ setupRequired: false, authenticated: false })
      mockLogout.mockResolvedValue({ success: true })
      mockLogin.mockResolvedValue({ success: true })

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      // Wait for initial fetch
      await new Promise(resolve => setTimeout(resolve, 0))

      // Simulate being authenticated first.
      await auth.login('secret123')
      expect(auth.isAuthenticated).toBe(true)

      await auth.logout()

      expect(mockLogout).toHaveBeenCalled()
      expect(auth.isAuthenticated).toBe(false)
      expect(auth.setupRequired).toBe(false)
    })
  })

  describe('setup()', () => {
    it('calls api.setup and flips isAuthenticated to true on success', async () => {
      mockAuthStatus.mockResolvedValue({ setupRequired: true, authenticated: false })
      mockSetup.mockResolvedValue({ success: true })

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(auth.isAuthenticated).toBe(false)

      await auth.setup('password123')

      expect(mockSetup).toHaveBeenCalledWith('password123')
      expect(auth.isAuthenticated).toBe(true)
    })

    it('re-throws on api.setup rejection', async () => {
      mockAuthStatus.mockResolvedValue({ setupRequired: true, authenticated: false })
      mockSetup.mockRejectedValue(new Error('Password already set'))

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      await expect(auth.setup('password123')).rejects.toThrow('Password already set')
      expect(auth.isAuthenticated).toBe(false)
    })
  })

  describe('readonly state', () => {
    it('isAuthenticated is readonly - assignment is ignored', async () => {
      mockAuthStatus.mockResolvedValue({ setupRequired: false, authenticated: false })

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      const originalValue = auth.isAuthenticated

      // Vue's readonly wrapper ignores mutation, just warns at runtime.
      // The TS type is Readonly so we use a cast to bypass the compiler.
      ;(auth as { isAuthenticated: boolean }).isAuthenticated = true

      // Value should remain unchanged
      expect(auth.isAuthenticated).toBe(originalValue)
    })

    it('setupRequired is readonly - assignment is ignored', async () => {
      mockAuthStatus.mockResolvedValue({ setupRequired: true, authenticated: false })

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      const originalValue = auth.setupRequired

      ;(auth as { setupRequired: boolean }).setupRequired = false

      expect(auth.setupRequired).toBe(originalValue)
    })

    it('loading is readonly - assignment is ignored', async () => {
      mockAuthStatus.mockResolvedValue({ setupRequired: false, authenticated: false })

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      const originalValue = auth.loading

      ;(auth as { loading: boolean }).loading = true

      expect(auth.loading).toBe(originalValue)
    })

    it('error is readonly - assignment is ignored', async () => {
      mockAuthStatus.mockResolvedValue({ setupRequired: false, authenticated: false })

      const { useAuth } = await import('./useAuth.js')
      const auth = useAuth()

      await new Promise(resolve => setTimeout(resolve, 0))

      const originalValue = auth.error

      ;(auth as { error: string | null }).error = 'new error'

      expect(auth.error).toBe(originalValue)
    })
  })
})
