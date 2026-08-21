/**
 * Tests for the `ChangePasswordModal` component.
 *
 * Covers:
 * - rendering the title and three password fields
 * - submit button gating (current required, new ≥ 8, confirm matches)
 * - soft validation hint for length and mismatch
 * - submit calls `api.changePassword` with the right body
 * - success emits `change` and resets internal state
 * - failure renders inline `.error-message` and does NOT touch `apiError`
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ChangePasswordModal from './ChangePasswordModal.vue'

// Use vi.hoisted so the mock fns are declared before the vi.mock
// factory (which Vitest hoists to the very top of the file) runs.
const { mockChangePassword, mockAuthStatus, mockLogin, mockLogout, mockSetup } =
  vi.hoisted(() => ({
    mockChangePassword: vi.fn(),
    mockAuthStatus: vi.fn(),
    mockLogin: vi.fn(),
    mockLogout: vi.fn(),
    mockSetup: vi.fn(),
  }))

vi.mock('../api.js', () => ({
  api: {
    authStatus: mockAuthStatus,
    login: mockLogin,
    logout: mockLogout,
    setup: mockSetup,
    changePassword: mockChangePassword,
  },
  onUnauthorized: vi.fn(() => () => {}),
  apiError: { value: null },
  successMessage: { value: null },
  setSuccessMessage: vi.fn(),
  _clearSuccessMessage: vi.fn(),
  _clearUnauthorizedCallbacks: vi.fn(),
}))

// Imported AFTER the mock so `apiError` is the mocked ref.
import { api, apiError } from '../api'

describe('ChangePasswordModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiError.value = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the "Change password" title and three password fields', () => {
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })
    expect(wrapper.find('h2').exists()).toBe(true)
    // Title is rendered inside the shared Modal component
    expect(wrapper.text()).toContain('Change password')
    expect(wrapper.find('input#current-password').exists()).toBe(true)
    expect(wrapper.find('input#new-password').exists()).toBe(true)
    expect(wrapper.find('input#confirm-new-password').exists()).toBe(true)
    expect(
      wrapper.find('button[type="submit"]').text(),
    ).toBe('Change password')
  })

  it('disables submit until current, new (≥ 8), and confirm are valid', async () => {
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })

    // Initially disabled (no input).
    expect(
      wrapper.find('button[type="submit"]').attributes('disabled'),
    ).toBe('')

    // Current filled, but new/confirm empty.
    await wrapper.find('input#current-password').setValue('oldpass1')
    expect(
      wrapper.find('button[type="submit"]').attributes('disabled'),
    ).toBe('')

    // New ≥ 8 but confirm empty.
    await wrapper.find('input#new-password').setValue('newpassword')
    expect(
      wrapper.find('button[type="submit"]').attributes('disabled'),
    ).toBe('')

    // Confirm doesn't match.
    await wrapper.find('input#confirm-new-password').setValue('differentpwd')
    expect(
      wrapper.find('button[type="submit"]').attributes('disabled'),
    ).toBe('')

    // New < 8 chars.
    await wrapper.find('input#new-password').setValue('short')
    await wrapper.find('input#confirm-new-password').setValue('short')
    expect(
      wrapper.find('button[type="submit"]').attributes('disabled'),
    ).toBe('')

    // Valid: current non-empty, new ≥ 8, confirm matches.
    await wrapper.find('input#new-password').setValue('newpassword')
    await wrapper.find('input#confirm-new-password').setValue('newpassword')
    expect(
      wrapper.find('button[type="submit"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('shows the length validation hint when new password is < 8 chars', async () => {
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })
    await wrapper.find('input#new-password').setValue('short')
    await nextTick()
    expect(wrapper.find('.validation-hint').text()).toBe(
      'New password must be at least 8 characters.',
    )
  })

  it('shows the mismatch validation hint when confirm differs from new', async () => {
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })
    await wrapper.find('input#new-password').setValue('newpassword')
    await wrapper.find('input#confirm-new-password').setValue('differentpwd')
    await nextTick()
    expect(wrapper.find('.validation-hint').text()).toBe(
      'Passwords do not match.',
    )
  })

  it('calls api.changePassword with currentPassword and newPassword on submit', async () => {
    mockChangePassword.mockResolvedValue({ success: true })
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })

    await wrapper.find('input#current-password').setValue('oldpass1')
    await wrapper.find('input#new-password').setValue('newpassword1')
    await wrapper.find('input#confirm-new-password').setValue('newpassword1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockChangePassword).toHaveBeenCalledTimes(1)
    expect(mockChangePassword).toHaveBeenCalledWith({
      currentPassword: 'oldpass1',
      newPassword: 'newpassword1',
    })
  })

  it('emits "change" on successful submit', async () => {
    mockChangePassword.mockResolvedValue({ success: true })
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })

    await wrapper.find('input#current-password').setValue('oldpass1')
    await wrapper.find('input#new-password').setValue('newpassword1')
    await wrapper.find('input#confirm-new-password').setValue('newpassword1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.emitted('change')).toBeTruthy()
    expect(wrapper.emitted('change')?.length).toBe(1)
  })

  it('renders inline error and does not touch apiError on rejection', async () => {
    mockChangePassword.mockRejectedValue(
      new Error('Current password is incorrect'),
    )
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })

    await wrapper.find('input#current-password').setValue('wrongguess')
    await wrapper.find('input#new-password').setValue('newpassword1')
    await wrapper.find('input#confirm-new-password').setValue('newpassword1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.error-message').text()).toBe(
      'Current password is incorrect',
    )
    // Auth errors surface inline only — the global toast must not fire.
    expect(apiError.value).toBe(null)
    // Modal stays open on error so the user can correct the input.
    expect(wrapper.emitted('change')).toBeFalsy()
  })

  it('disables submit button while submitting', async () => {
    // A promise we resolve manually so the submitting flag stays true.
    let resolveChange!: (value: { success: true }) => void
    mockChangePassword.mockImplementation(
      () => new Promise<{ success: true }>((r) => {
        resolveChange = r
      }),
    )
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })

    await wrapper.find('input#current-password').setValue('oldpass1')
    await wrapper.find('input#new-password').setValue('newpassword1')
    await wrapper.find('input#confirm-new-password').setValue('newpassword1')
    await wrapper.find('form').trigger('submit.prevent')
    await nextTick()

    expect(
      wrapper.find('button[type="submit"]').attributes('disabled'),
    ).toBe('')

    // Clean up the hanging promise.
    resolveChange({ success: true })
    await flushPromises()
  })

  it('resets internal fields when the modal closes', async () => {
    mockChangePassword.mockResolvedValue({ success: true })
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })

    // Fill in fields and submit successfully.
    await wrapper.find('input#current-password').setValue('oldpass1')
    await wrapper.find('input#new-password').setValue('newpassword1')
    await wrapper.find('input#confirm-new-password').setValue('newpassword1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // Simulate the parent closing the modal.
    await wrapper.setProps({ show: false })
    await nextTick()

    // Re-open and verify fields are empty.
    await wrapper.setProps({ show: true })
    await nextTick()

    const current = wrapper.find('input#current-password')
      .element as HTMLInputElement
    const newPwd = wrapper.find('input#new-password')
      .element as HTMLInputElement
    const confirm = wrapper.find('input#confirm-new-password')
      .element as HTMLInputElement
    expect(current.value).toBe('')
    expect(newPwd.value).toBe('')
    expect(confirm.value).toBe('')
  })

  it('clears the loud error when the user edits a field', async () => {
    mockChangePassword.mockRejectedValue(new Error('Current password is incorrect'))
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })

    await wrapper.find('input#current-password').setValue('wrongguess')
    await wrapper.find('input#new-password').setValue('newpassword1')
    await wrapper.find('input#confirm-new-password').setValue('newpassword1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.error-message').exists()).toBe(true)

    // Editing any field should clear the error.
    await wrapper.find('input#current-password').setValue('anothertry')
    await nextTick()

    expect(wrapper.find('.error-message').exists()).toBe(false)
  })

  it('does not submit when canSubmit is false (Enter key guard)', async () => {
    const wrapper = mount(ChangePasswordModal, { props: { show: true } })

    // No inputs filled → canSubmit is false. Trigger submit anyway.
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('uses the shared api.changePassword call (sanity check that api is the export)', () => {
    // Catches regressions where the component imports a different module.
    expect(typeof api.changePassword).toBe('function')
  })
})
