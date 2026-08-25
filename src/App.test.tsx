import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AUTH_STORAGE_KEY, DEMO_OTP, clearAuthSession } from './domain/auth'
import { WORKSPACE_STORAGE_KEY, loadWorkspace } from './domain/workspace'

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
  await screen.findByRole('heading', { name: 'Here’s what your agreement needs' })
}

async function finalizeDocument(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Create Agreement' }))
  await screen.findByRole('heading', { name: 'Choose what matters for your home.' })
  await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
  await screen.findByRole('heading', { name: 'Review' })
  await user.click(screen.getByRole('button', { name: 'Finalize document' }))
  await screen.findByRole('heading', { name: 'Finalized agreement' })
}

describe('persistent multi-document journey', () => {
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

  it('prefills either stable demo identity from the login screen', async () => {
    render(<App />)
    const user = userEvent.setup()
    const dialog = await screen.findByRole('dialog', { name: 'Simulated Aadhaar OTP' })
    const identifier = within(dialog).getByRole('textbox', { name: 'Aadhaar number' })

    await user.click(within(dialog).getByRole('button', { name: 'Prefill Arjun Rao Aadhaar 4444 5555 6666' }))
    expect(identifier).toHaveValue('4444 5555 6666')
    await user.click(within(dialog).getByRole('button', { name: 'Send OTP' }))
    await user.click(within(screen.getByLabelText('Demo message')).getByRole('button', { name: 'Prefill from Messages' }))

    expect(await screen.findByText('Arjun Rao')).toBeInTheDocument()
  })

  it('encrypts Aadhaar locally and restores the browser session', async () => {
    const first = render(<App />)
    await login()
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    expect(stored).toContain('AES-GCM')
    expect(stored).not.toContain(TEST_AADHAAR)
    first.unmount()

    render(<App />)
    expect(await screen.findByText('Meera Sharma')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Simulated Aadhaar OTP' })).not.toBeInTheDocument()
  })

  it('persists an incomplete intake draft and role across a reload', async () => {
    const first = render(<App />)
    const user = await login()
    await user.click(screen.getByRole('button', { name: 'Rent Agreement' }))
    await user.click(screen.getByRole('button', { name: 'Use demo details' }))
    expect(screen.getByText('You’re the tenant')).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    first.unmount()

    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Tell us about the tenancy' })).toBeInTheDocument()
    expect(screen.getByLabelText('Property address')).toHaveValue('24A, Lotus Heights, Indiranagar, Bengaluru')
    expect(screen.getByText('You’re the tenant')).toBeInTheDocument()
  })

  it('synchronizes the profile with the selected party and swaps names on a role change', async () => {
    render(<App />)
    const user = await login()
    await user.click(screen.getByRole('button', { name: 'Rent Agreement' }))
    await user.click(screen.getByRole('button', { name: 'Use demo details' }))

    expect(screen.getByLabelText('Tenant name')).toHaveValue('Meera Sharma')
    expect(screen.getByLabelText('Document name')).toHaveValue('Arjun Rao & Meera Sharma')
    await user.click(screen.getByLabelText('Landlord'))
    expect(screen.getByLabelText('Landlord name')).toHaveValue('Meera Sharma')
    expect(screen.getByLabelText('Tenant name')).toHaveValue('Arjun Rao')
    expect(screen.getByLabelText('Document name')).toHaveValue('Meera Sharma & Arjun Rao')
    expect(screen.getByText('You’re the landlord')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Document name'))
    await user.type(screen.getByLabelText('Document name'), 'Indiranagar home lease')
    await user.clear(screen.getByLabelText('Tenant name'))
    await user.type(screen.getByLabelText('Tenant name'), 'Dev Rao')
    expect(screen.getByLabelText('Document name')).toHaveValue('Indiranagar home lease')
    expect(screen.getByRole('option', { name: 'Indiranagar home lease' })).toBeInTheDocument()
  })

  it('keeps multiple documents and switches back to an existing document', async () => {
    render(<App />)
    const user = await login()
    await completeDemoIntake(user)
    const existingId = loadWorkspace().activeDocumentId

    await user.click(screen.getByRole('button', { name: 'New document' }))
    expect(await screen.findByRole('heading', { name: 'What do you need to get done?' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Active document' }), existingId)
    expect(await screen.findByRole('heading', { name: 'Here’s what your agreement needs' })).toBeInTheDocument()
  })

  it('explains the transaction requirements and creates the agreement through the existing journey', async () => {
    render(<App />)
    const user = await login()
    await completeDemoIntake(user)

    expect(screen.getByText('Residential Rent Agreement')).toBeInTheDocument()
    expect(screen.getByText('Bengaluru, Karnataka · 11 months')).toBeInTheDocument()
    expect(screen.getByText('₹1,800')).toBeInTheDocument()
    expect(screen.getByText('Landlord + Tenant')).toBeInTheDocument()
    expect(screen.getByText('Stamp duty must be completed before execution.')).toBeInTheDocument()
    expect(screen.getByText('You can add notarial attestation during execution.')).toBeInTheDocument()
    expect(screen.getByText('Registration is not required for this demo scenario.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { name: 'Tell us about the tenancy' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Review what you need' }))
    await screen.findByRole('heading', { name: 'Here’s what your agreement needs' })
    await user.click(screen.getByRole('button', { name: 'Create Agreement' }))
    expect(await screen.findByRole('heading', { name: 'Choose what matters for your home.' })).toBeInTheDocument()
  })

  it('configures clauses, updates the preview, and persists the builder before review', async () => {
    render(<App />)
    const user = await login()
    await completeDemoIntake(user)
    await user.click(screen.getByRole('button', { name: 'Create Agreement' }))
    await screen.findByRole('heading', { name: 'Choose what matters for your home.' })

    expect(screen.getAllByText(/30 days after handover/).length).toBeGreaterThan(0)
    await user.clear(screen.getByLabelText('Refund within (days after handover)'))
    await user.type(screen.getByLabelText('Refund within (days after handover)'), '7')
    expect(screen.getAllByText(/within 7 days after handover/).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Parking & Restoration/ }))
    await user.click(screen.getByText('Parking included'))
    expect(screen.getAllByText(/tenancy includes car parking/i).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
    expect(await screen.findByRole('heading', { name: 'Review' })).toBeInTheDocument()
    const stored = loadWorkspace().documents[loadWorkspace().activeDocumentId].agreement
    expect(stored.agreementBuilder?.deposit.refundDays).toBe(7)
    expect(stored.clauses.find((clause) => clause.id === 'security-deposit-refund')?.text).toContain('within 7 days')
  })

  it('hides Share until finalization, then exports stored state without changing the current URL', async () => {
    render(<App />)
    const user = await login()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    await completeDemoIntake(user)
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Steps' })).toBeInTheDocument()

    await finalizeDocument(user)
    expect(screen.getByText(/read-only/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(window.location.hash).toBe('')

    await user.click(screen.getByRole('button', { name: 'Share' }))
    const inviteLink = screen.getByLabelText('Invite link') as HTMLTextAreaElement
    expect(inviteLink.value).toContain('#share=')
    expect(screen.queryByText(/link is compressed/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy invite link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(inviteLink.value))
  })

  it('shares a partial split payment so the other role can import and complete it', async () => {
    const firstBrowser = render(<App />)
    const firstUser = await login()
    await completeDemoIntake(firstUser)
    const tenantParticipantId = loadWorkspace().documents[loadWorkspace().activeDocumentId].agreement.tenant.participantId
    await finalizeDocument(firstUser)
    await firstUser.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'Stamp duty' })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await firstUser.click(screen.getByRole('button', { name: 'Pay ₹900' }))
    expect(await screen.findByText('Contribution received.')).toBeInTheDocument()
    expect(screen.getByText(/share the document with the landlord/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await firstUser.click(screen.getByRole('button', { name: 'Share' }))
    const inviteUrl = (screen.getByLabelText('Invite link') as HTMLTextAreaElement).value

    firstBrowser.unmount()
    await clearAuthSession()
    localStorage.clear()
    window.history.replaceState(null, '', inviteUrl)

    render(<App />)
    const secondUser = await login('987654321098', 'Stamp duty')
    expect(screen.getByRole('status')).toHaveTextContent('Shared agreement imported')
    expect(screen.getByText('You’re the landlord')).toBeInTheDocument()
    expect(screen.getByText('Split locked')).toBeInTheDocument()
    expect(screen.getByText(/SS-STAMP-/)).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toContain('Bengaluru')
    const importedAgreement = loadWorkspace().documents[loadWorkspace().activeDocumentId].agreement
    expect(importedAgreement.landlord.participantId).toBeTruthy()
    expect(importedAgreement.landlord.participantId).not.toBe(tenantParticipantId)
    await secondUser.click(screen.getByRole('button', { name: 'Pay ₹900' }))
    expect(await screen.findByText(/stamp duty completed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    await secondUser.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('heading', { name: 'Identity' })).toBeInTheDocument()
  })

  it('executes the remaining steps while keeping pre-finalization steps locked', async () => {
    render(<App />)
    const user = await login()
    await completeDemoIntake(user)
    await finalizeDocument(user)

    expect(screen.getByRole('button', { name: /5\. Review, locked/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    for (const heading of ['Stamp duty', 'Identity', 'Notary', 'eSign', 'Completion']) {
      await user.click(screen.getByRole('button', { name: 'Continue' }))
      await screen.findByRole('heading', { name: heading })
      if (heading === 'Stamp duty') {
        await user.click(screen.getByRole('button', { name: 'Tenant 100%' }))
        await user.click(screen.getByRole('button', { name: 'Pay ₹1,800' }))
        await screen.findByText(/stamp duty completed/i)
      }
      expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { name: 'eSign' })).toBeInTheDocument()
  })

  it('logout preserves documents and the next login restores the active finalized view', async () => {
    render(<App />)
    const user = await login()
    await completeDemoIntake(user)
    await finalizeDocument(user)
    const storedBeforeLogout = localStorage.getItem(WORKSPACE_STORAGE_KEY)

    await user.click(screen.getByRole('button', { name: 'Logout' }))
    await waitFor(() => expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull())
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(storedBeforeLogout)
    expect(await screen.findByRole('dialog', { name: 'Simulated Aadhaar OTP' })).toBeInTheDocument()

    await login(TEST_AADHAAR, 'Finalized agreement')
    expect(screen.getByText('You’re the tenant')).toBeInTheDocument()
  })
})
