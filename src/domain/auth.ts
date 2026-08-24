export const AUTH_STORAGE_KEY = 'build-india-demo-session-v1'
export const DEMO_AADHAAR_DIGITS = '000000000000'
export const DEMO_OTP = '482913'

export interface EncryptedIdentifier {
  algorithm: 'AES-GCM'
  ciphertext: string
  iv: string
}

export interface DemoAuthSession {
  version: 1
  authenticated: true
  displayName: 'Demo Citizen'
  encryptedIdentifier: EncryptedIdentifier
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export async function encryptSyntheticIdentifier(value: string): Promise<EncryptedIdentifier> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
  ])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(value)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  return {
    algorithm: 'AES-GCM',
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  }
}

export function loadAuthSession(): DemoAuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<DemoAuthSession>
    if (
      value.version !== 1 ||
      value.authenticated !== true ||
      value.displayName !== 'Demo Citizen' ||
      value.encryptedIdentifier?.algorithm !== 'AES-GCM' ||
      !value.encryptedIdentifier.ciphertext ||
      !value.encryptedIdentifier.iv
    ) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
    return value as DemoAuthSession
  } catch {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
    return null
  }
}

export function saveAuthSession(session: DemoAuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // The in-memory session is still cleared by the caller.
  }
}
