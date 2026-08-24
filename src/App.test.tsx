import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AUTH_STORAGE_KEY, DEMO_OTP, clearAuthSession } from './domain/auth'

const TEST_AADHAAR = '123456789012'

async function login(aadhaar = TEST_AADHAAR, destination = 'What do you need to get done?') {
  const user = userEvent.setup()
  const dialog = await screen.findByRole('dialog', { name: 'Simulated Aadhaar OTP' })
  await user.type(within(dialog).getByRole('textbox', { name: 'Aadhaar number' }), aadhaar)
  await user.click(within(dialog).getByRole('button', { name: 'Send OTP' }))
  const message = screen.getByLabelText('Demo message')
  expect(within(message).getByText(new RegExp(DEMO_OTP))).toBeInTheDocument()
  await user.click(within(message).getByRole('button', { name: 'Prefill from Messages' }))
  await screen.findByRole('heading', { name: destination })
  return user
}

async function completeDemoIntake(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Rent Agreement' }))
  await user.click(screen.getByRole('button', { name: 'Use demo details' }))
  await user.click(screen.getByRole('button', { name: 'Review what you need' }))
  await screen.findByRole('heading', { name: 'Requirements' })
}

describe('multi-user intake journey', () => {
  it('accepts any complete 12-digit number and rejects incomplete input or incorrect OTP', async () => {
    render(<App />)
    const user = userEvent.setup()
    const identifier = await screen.findByRole('textbox', { name: 'Aadhaar number' })
    await user.type(identifier, '123456')
    await user.click(screen.getByRole('button', { name: 'Send OTP' }))
    expect(screen.getByText(/complete 12-digit/)).toBeInTheDocument()

    await user.clear(identifier)
    await user.type(identifier, TEST_AADHAAR)
    await user.click(screen.getByRole('button', { name: 'Send OTP' }))
    await user.type(screen.getByRole('textbox', { name: '6-digit OTP' }), '111111')
    await user.click(screen.getByRole('button', { name: 'Verify & continue' }))
    expect(screen.getByText(/does not match the code/)).toBeInTheDocument()
  })

  it('encrypts Aadhaar locally and stores no plaintext identifier or OTP', async () => {
    render(<App />)
    await login()

    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    expect(stored).toContain('AES-GCM')
    expect(stored).toContain('Meera Sharma')
    expect(stored).not.toContain(TEST_AADHAAR)
    expect(stored).not.toContain(DEMO_OTP)
  })

  it('restores the encrypted session after remount and discards malformed storage', async () => {
    const first = render(<App />)
    await login()
    first.unmount()

    const second = render(<App />)
    expect(await screen.findByText('Meera Sharma')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Simulated Aadhaar OTP' })).not.toBeInTheDocument()
    second.unmount()

    localStorage.setItem(AUTH_STORAGE_KEY, '{"authenticated":true}')
    render(<App />)
    expect(await screen.findByRole('dialog', { name: 'Simulated Aadhaar OTP' })).toBeInTheDocument()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('synchronizes the profile with the selected party and swaps names on a role change', async () => {
    render(<App />)
    const user = await login()
    await user.click(screen.getByRole('button', { name: 'Rent Agreement' }))
    await user.click(screen.getByRole('button', { name: 'Use demo details' }))

    expect(screen.getByLabelText('Tenant name')).toHaveValue('Meera Sharma')
    expect(screen.getByLabelText('Landlord name')).toHaveValue('Arjun Rao')
    await user.click(screen.getByLabelText('Landlord'))
    expect(screen.getByLabelText('Landlord name')).toHaveValue('Meera Sharma')
    expect(screen.getByLabelText('Tenant name')).toHaveValue('Arjun Rao')

    await user.clear(screen.getByLabelText('Landlord name'))
    await user.type(screen.getByLabelText('Landlord name'), 'Kavya Rao')
    expect(screen.getByRole('button', { name: /Kavya Rao/ })).toBeInTheDocument()
  })

  it('creates a role-specific URL without authentication data', async () => {
    render(<App />)
    const user = await login()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    await completeDemoIntake(user)

    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(screen.getByRole('heading', { name: 'Invite the landlord' })).toBeInTheDocument()
    const inviteLink = screen.getByLabelText('Invite link') as HTMLTextAreaElement
    expect(inviteLink.value).toContain('#share=')
    expect(inviteLink.value).not.toContain(TEST_AADHAAR)
    expect(inviteLink.value).not.toContain('AES-GCM')

    await user.click(screen.getByRole('button', { name: 'Copy invite link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(inviteLink.value))
  })

  it('loads the same snapshot on a second local identity as the invited role', async () => {
    const firstBrowser = render(<App />)
    const firstUser = await login()
    await completeDemoIntake(firstUser)
    await firstUser.click(screen.getByRole('button', { name: 'Share' }))
    const inviteUrl = (screen.getByLabelText('Invite link') as HTMLTextAreaElement).value
    expect(screen.getByRole('heading', { name: 'Invite the landlord' })).toBeInTheDocument()

    firstBrowser.unmount()
    await clearAuthSession()
    localStorage.clear()
    window.history.replaceState(null, '', inviteUrl)

    render(<App />)
    const secondUser = await login('987654321098', 'Requirements')
    expect(screen.getByRole('status')).toHaveTextContent('Shared agreement loaded')
    expect(screen.getByRole('button', { name: /Arjun Rao/ })).toBeInTheDocument()

    await secondUser.click(screen.getByRole('button', { name: 'Share' }))
    expect(screen.getByRole('heading', { name: 'Invite the tenant' })).toBeInTheDocument()
    expect(window.location.hash).toContain('share=')
  })

  it('logout clears the local session, snapshot URL, and returns to the gate', async () => {
    render(<App />)
    const user = await login()
    await completeDemoIntake(user)
    expect(window.location.hash).toContain('share=')
    await user.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull())
    expect(window.location.hash).toBe('')
    expect(await screen.findByRole('dialog', { name: 'Simulated Aadhaar OTP' })).toBeInTheDocument()
  })
})
