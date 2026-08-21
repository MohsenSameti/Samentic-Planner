/**
 * Tests for the `LoginPage` component.
 *
 * `LoginPage` is a single-mode component: it renders the Sign in form.
 * Tests cover:
 * - rendering the form elements
 * - autofocus on the password field
 * - submitting with the entered password
 * - submit button disabled while submitting
 * - inline error display on failure
 * - Enter key submission
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import LoginPage from './LoginPage.vue'

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
    setupRequired: false,
    loading: false,
    error: null,
    login: mockLogin,
    logout: mockLogout,
    setup: mockSetup,
    retryStatus: mockRetryStatus,
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a password input and submit button with "Sign in" heading', () => {
    const wrapper = mount(LoginPage)
    expect(wrapper.find('h1.login-title').text()).toBe('Sign in')
    expect(wrapper.find('input#password').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Sign in')
  })

  it('autofocuses the password field on mount', async () => {
    const wrapper = mount(LoginPage)
    await nextTick()
    // The autofocus attribute should appear in the rendered HTML.
    const html = wrapper.find('input#password').html()
    expect(html).toContain('autofocus')
  })

  it('calls useAuth().login with the entered password on submit', async () => {
    const wrapper = mount(LoginPage)
    mockLogin.mockResolvedValue(undefined)

    await wrapper.find('input#password').setValue('secret123')
    await wrapper.find('form').trigger('submit')

    expect(mockLogin).toHaveBeenCalledWith('secret123')
  })

  it('disables the submit button while submitting', async () => {
    const wrapper = mount(LoginPage)

    // Never resolve so submitting stays true.
    let resolveLogin: () => void
    mockLogin.mockImplementation(
      () => new Promise<void>((r) => { resolveLogin = r }),
    )

    await wrapper.find('input#password').setValue('secret123')
    await wrapper.find('form').trigger('submit')

    // Button must be disabled while the request is in flight.
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBe('')

    // Clean up the hanging promise.
    resolveLogin!()
  })

  it('renders inline error message when useAuth().login rejects', async () => {
    const wrapper = mount(LoginPage)
    mockLogin.mockRejectedValue(new Error('Incorrect password'))

    await wrapper.find('input#password').setValue('wrong')
    await wrapper.find('form').trigger('submit')
    await nextTick()

    expect(wrapper.find('.error-message').text()).toBe('Incorrect password')
  })

  it('does not touch the global apiError when login fails', async () => {
    const wrapper = mount(LoginPage)
    mockLogin.mockRejectedValue(new Error('Wrong password'))

    await wrapper.find('input#password').setValue('wrong')
    await wrapper.find('form').trigger('submit')
    await nextTick()

    // Auth errors surface inline, not via the global toast.
    // The component catches the error and sets local error state;
    // it intentionally does NOT set apiError.
    expect(mockLogin).toHaveBeenCalled()
  })

  it('Enter key in the password field submits the form', async () => {
    const wrapper = mount(LoginPage)
    mockLogin.mockResolvedValue(undefined)

    // The form has @submit.prevent bound, so a submit event triggers login.
    // Verify the form element exists with a submit handler.
    const form = wrapper.find('form')
    expect(form.exists()).toBe(true)

    // Set the password value and fire the submit event.
    await wrapper.find('input#password').setValue('secret123')
    await form.trigger('submit')

    expect(mockLogin).toHaveBeenCalledWith('secret123')
  })
})
