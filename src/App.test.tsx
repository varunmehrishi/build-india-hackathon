import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { AUTH_STORAGE_KEY, DEMO_AADHAAR_DIGITS, DEMO_OTP } from './domain/auth'

async function login() {
  const user = userEvent.setup()
  const dialog = screen.getByRole('dialog', { name: 'Simulated Aadhaar OTP' })
  await user.type(within(dialog).getByRole('textbox', { name: 'Demo Aadhaar number' }), DEMO_AADHAAR_DIGITS)
  await user.click(within(dialog).getByRole('button', { name: 'Send OTP' }))
  const message = screen.getByLabelText('Demo message')
  expect(within(message).getByText(new RegExp(DEMO_OTP))).toBeInTheDocument()
  await user.click(within(message).getByRole('button', { name: 'Prefill from Messages' }))
  await screen.findByRole('heading', { name: 'What do you need to get done?' })
  return user
}

describe('intake journey', () => {
  it('rejects real-looking identifiers and incorrect OTPs', async () => {
    render(<App />)
    const user = userEvent.setup()
    const identifier = screen.getByRole('textbox', {
      name: 'Demo Aadhaar number',
    })
    await user.type(identifier, '123456789012')
    await user.click(screen.getByRole('button', { name: 'Send OTP' }))
    expect(screen.getByText(/Do not enter a real number/)).toBeInTheDocument()

    await user.clear(identifier)
    await user.type(identifier, DEMO_AADHAAR_DIGITS)
    await user.click(screen.getByRole('button', { name: 'Send OTP' }))
    await user.type(screen.getByRole('textbox', { name: '6-digit OTP' }), '111111')
    await user.click(screen.getByRole('button', { name: 'Verify & continue' }))
    expect(screen.getByText(/does not match the code/)).toBeInTheDocument()
  })

  it('gates the app and stores no plaintext identifier or OTP', async () => {
    render(<App />)
    expect(screen.getByRole('dialog', { name: 'Simulated Aadhaar OTP' })).toBeInTheDocument()

    await login()

    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    expect(stored).toContain('AES-GCM')
    expect(stored).not.toContain(DEMO_AADHAAR_DIGITS)
    expect(stored).not.toContain(DEMO_OTP)
  })

  it('restores a valid session after remount and discards malformed storage', async () => {
    const first = render(<App />)
    await login()
    first.unmount()

    const second = render(<App />)
    expect(screen.queryByRole('dialog', { name: 'Simulated Aadhaar OTP' })).not.toBeInTheDocument()
    expect(screen.getByText('Demo Citizen')).toBeInTheDocument()
    second.unmount()

    localStorage.setItem(AUTH_STORAGE_KEY, '{"authenticated":true}')
    render(<App />)
    expect(screen.getByRole('dialog', { name: 'Simulated Aadhaar OTP' })).toBeInTheDocument()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('rejects unsupported intent and completes the demo intake', async () => {
    render(<App />)
    const user = await login()
    const intent = screen.getByLabelText('Describe what you need')

    await user.type(intent, 'I need an affidavit')
    await user.click(screen.getByRole('button', { name: 'Find my workflow' }))
    expect(screen.getByRole('alert')).toHaveTextContent('currently supports residential rent agreements')

    await user.clear(intent)
    await user.type(intent, 'I need a lease for my flat')
    await user.click(screen.getByRole('button', { name: 'Find my workflow' }))
    expect(await screen.findByRole('heading', { name: 'Tell us about the tenancy' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Review what you need' }))
    expect(screen.getByRole('alert')).toHaveTextContent('11 fields need attention')

    await user.click(screen.getByRole('button', { name: 'Use demo details' }))
    expect(screen.getByLabelText('City')).toHaveValue('Bengaluru')
    await user.click(screen.getByRole('button', { name: 'Review what you need' }))

    expect(await screen.findByRole('heading', { name: 'Requirements' })).toBeInTheDocument()
    expect(screen.getByText('11-month residential tenancy')).toBeInTheDocument()
    expect(screen.getByText('Bengaluru, Karnataka')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agreement, locked/ })).toBeDisabled()
  })

  it('logout clears the local session and returns to a pristine gate', async () => {
    render(<App />)
    const user = await login()
    await user.click(screen.getByRole('button', { name: 'Rent Agreement' }))
    await user.click(screen.getByRole('button', { name: 'Use demo details' }))
    await user.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Simulated Aadhaar OTP' })).toBeInTheDocument()
  })
})
