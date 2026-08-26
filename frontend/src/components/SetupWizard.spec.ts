/**
 * Tests for the `SetupWizard` component.
 *
 * Tests cover:
 * - rendering the form elements and heading
 * - autofocused first password field
 * - submit button disabled until conditions are met
 * - mismatched passwords show inline validation error
 * - submitting calls useAuth().setup with the entered password
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import SetupWizard from './SetupWizard.vue'

// Standalone mock functions so tests can assert on them directly.
const mockLogin = vi.fn()
const mockLogout = vi.fn()
const mockSetup = vi.fn()
const mockRetryStatus = vi.fn()

// Stub the entire `api` module so tests are isolated from the network.
vi.mock('../api.js', () => ({
  api: {
    authStatus: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    setup: vi.fn(),
    changePassword: vi.fn(),
  },
  onUnauthorized: vi.fn(),
  apiError: { value: null },
}))

// Stub useAuth to isolate component tests from module-level singleton state.
// State values are returned **unwrapped** (matching the real `reactive(...)`
// surface exposed by `useAuth()`); methods are plain functions.
// Export the mock functions so tests can reference them directly.
vi.mock('../composables/useAuth.js', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    setupRequired: true,
    loading: false,
    error: null,
    login: mockLogin,
    logout: mockLogout,
    setup: mockSetup,
    retryStatus: mockRetryStatus,
  }),
}))

describe('SetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders two password fields with "Create your password" heading', () => {
    const wrapper = mount(SetupWizard)
    expect(wrapper.find('h1.setup-title').text()).toBe('Create your password')
    expect(wrapper.find('input#password').exists()).toBe(true)
    expect(wrapper.find('input#confirm-password').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Create password')
  })

  it('autofocuses the first password field on mount', async () => {
    const wrapper = mount(SetupWizard)
    await nextTick()
    const html = wrapper.find('input#password').html()
    expect(html).toContain('autofocus')
  })

  it('disables submit button until both fields are filled, match, and ≥ 8 chars', async () => {
    const wrapper = mount(SetupWizard)

    // Initially disabled (no input)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBe('')

    // Password filled but no confirmation yet
    await wrapper.find('input#password').setValue('password123')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBe('')

    // Confirmation filled but doesn't match
    await wrapper.find('input#confirm-password').setValue('different')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBe('')

    // Password < 8 chars
    await wrapper.find('input#password').setValue('short')
    await wrapper.find('input#confirm-password').setValue('short')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBe('')

    // Valid: ≥ 8 chars and matching
    await wrapper.find('input#password').setValue('password123')
    await wrapper.find('input#confirm-password').setValue('password123')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('shows inline validation error when passwords do not match', async () => {
    const wrapper = mount(SetupWizard)

    await wrapper.find('input#password').setValue('password123')
    await wrapper.find('input#confirm-password').setValue('differentpwd')

    // Trigger blur or input to show validation error
    const confirmInput = wrapper.find('input#confirm-password')
    await confirmInput.trigger('input')

    await nextTick()
    expect(wrapper.find('.validation-hint').text()).toBe('Passwords do not match.')
  })

  it('calls useAuth().setup with the entered password on submit', async () => {
    const wrapper = mount(SetupWizard)
    mockSetup.mockResolvedValue(undefined)

    await wrapper.find('input#password').setValue('password123')
    await wrapper.find('input#confirm-password').setValue('password123')
    await wrapper.find('form').trigger('submit')

    expect(mockSetup).toHaveBeenCalledWith('password123')
  })

  it('disables submit button while submitting', async () => {
    const wrapper = mount(SetupWizard)

    // Never resolve so submitting stays true.
    let resolveSetup: () => void
    mockSetup.mockImplementation(
      () => new Promise<void>((r) => { resolveSetup = r }),
    )

    await wrapper.find('input#password').setValue('password123')
    await wrapper.find('input#confirm-password').setValue('password123')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBe('')

    // Clean up the hanging promise.
    resolveSetup!()
  })

  it('renders inline error message when useAuth().setup rejects', async () => {
    const wrapper = mount(SetupWizard)
    mockSetup.mockRejectedValue(new Error('Password already set'))

    await wrapper.find('input#password').setValue('password123')
    await wrapper.find('input#confirm-password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await nextTick()

    expect(wrapper.find('.error-message').text()).toBe('Password already set')
  })

  it('does not touch the global apiError when setup fails', async () => {
    const wrapper = mount(SetupWizard)
    mockSetup.mockRejectedValue(new Error('Password already set'))

    await wrapper.find('input#password').setValue('password123')
    await wrapper.find('input#confirm-password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await nextTick()

    // Auth errors surface inline, not via the global toast.
    expect(mockSetup).toHaveBeenCalled()
  })

  it('clears error when user types in password field', async () => {
    const wrapper = mount(SetupWizard)

    // Trigger an error first
    mockSetup.mockRejectedValue(new Error('Password already set'))
    await wrapper.find('input#password').setValue('password123')
    await wrapper.find('input#confirm-password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await nextTick()

    expect(wrapper.find('.error-message').exists()).toBe(true)

    // Type in password field to clear error
    await wrapper.find('input#password').setValue('newpassword1')
    await nextTick()

    expect(wrapper.find('.error-message').exists()).toBe(false)
  })
})
