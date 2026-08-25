import { describe, expect, it } from 'vitest'
import { DEMO_IDENTITIES, demoIdentityForAadhaar, participantIdForAadhaar } from './auth'

describe('stable demo identities', () => {
  it('derives the same opaque participant ID from the same Aadhaar number', async () => {
    const first = await participantIdForAadhaar(DEMO_IDENTITIES[0].aadhaar)
    const repeated = await participantIdForAadhaar(`1111 2222 3333`)
    const other = await participantIdForAadhaar(DEMO_IDENTITIES[1].aadhaar)

    expect(repeated).toBe(first)
    expect(other).not.toBe(first)
    expect(first).not.toContain(DEMO_IDENTITIES[0].aadhaar)
  })

  it('maps the two memorable numbers to their stable demo profiles', () => {
    expect(demoIdentityForAadhaar('1111 2222 3333')?.displayName).toBe('Meera Sharma')
    expect(demoIdentityForAadhaar('4444 5555 6666')?.displayName).toBe('Arjun Rao')
    expect(demoIdentityForAadhaar('123456789012')).toBeUndefined()
  })
})
