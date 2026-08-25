import type { PartyRole } from './types'

export const AUTH_STORAGE_KEY = 'build-india-demo-session-v2'
export const LEGACY_AUTH_STORAGE_KEY = 'build-india-demo-session-v1'
export const DEMO_OTP = '482913'

export const DEMO_IDENTITIES = [
  { aadhaar: '111122223333', displayName: 'Meera Sharma', roleLabel: 'Tenant' },
  { aadhaar: '444455556666', displayName: 'Arjun Rao', roleLabel: 'Landlord' },
] as const

const VAULT_DATABASE = 'build-india-identity-vault'
const VAULT_STORE = 'keys'
const VAULT_KEY_ID = 'aadhaar-aes-gcm-v1'

export interface EncryptedAadhaarRecord {
  algorithm: 'AES-GCM'
  ciphertext: string
  iv: string
  keyId: typeof VAULT_KEY_ID
}

export interface AgreementRoleBinding {
  agreementId: string
  role: PartyRole
}

export interface LocalIdentity {
  participantId: string
  displayName: string
  roleBindings: AgreementRoleBinding[]
}

export interface DemoAuthSession extends LocalIdentity {
  version: 2
  authenticated: true
  encryptedAadhaar: EncryptedAadhaarRecord
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function openVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(VAULT_DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(VAULT_STORE)) {
        request.result.createObjectStore(VAULT_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the identity vault'))
  })
}

async function getVaultKey(): Promise<CryptoKey | null> {
  const database = await openVault()
  try {
    const transaction = database.transaction(VAULT_STORE, 'readonly')
    return (await requestResult(transaction.objectStore(VAULT_STORE).get(VAULT_KEY_ID))) ?? null
  } finally {
    database.close()
  }
}

async function getOrCreateVaultKey(): Promise<CryptoKey> {
  const existing = await getVaultKey()
  if (existing) return existing

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
  const database = await openVault()
  try {
    const transaction = database.transaction(VAULT_STORE, 'readwrite')
    await requestResult(transaction.objectStore(VAULT_STORE).put(key, VAULT_KEY_ID))
  } finally {
    database.close()
  }
  return key
}

export async function encryptAadhaar(value: string): Promise<EncryptedAadhaarRecord> {
  const key = await getOrCreateVaultKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(value)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  return {
    algorithm: 'AES-GCM',
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    keyId: VAULT_KEY_ID,
  }
}

export async function participantIdForAadhaar(value: string): Promise<string> {
  const digits = value.replace(/\D/g, '')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`saral-setu:${digits}`))
  const identifier = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `participant-${identifier.slice(0, 24)}`
}

export function demoIdentityForAadhaar(value: string): typeof DEMO_IDENTITIES[number] | undefined {
  const digits = value.replace(/\D/g, '')
  return DEMO_IDENTITIES.find((identity) => identity.aadhaar === digits)
}

function isValidSession(value: unknown): value is DemoAuthSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<DemoAuthSession>
  return (
    session.version === 2 &&
    session.authenticated === true &&
    typeof session.participantId === 'string' &&
    session.participantId.length > 0 &&
    typeof session.displayName === 'string' &&
    session.displayName.trim().length >= 2 &&
    Array.isArray(session.roleBindings) &&
    session.roleBindings.every((binding) => (
      !!binding &&
      typeof binding.agreementId === 'string' &&
      (binding.role === 'landlord' || binding.role === 'tenant')
    )) &&
    session.encryptedAadhaar?.algorithm === 'AES-GCM' &&
    session.encryptedAadhaar.keyId === VAULT_KEY_ID &&
    typeof session.encryptedAadhaar.ciphertext === 'string' &&
    session.encryptedAadhaar.ciphertext.length > 0 &&
    typeof session.encryptedAadhaar.iv === 'string' &&
    session.encryptedAadhaar.iv.length > 0
  )
}

export async function restoreAuthSession(): Promise<DemoAuthSession | null> {
  try {
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const session: unknown = JSON.parse(raw)
    if (!isValidSession(session) || !(await getVaultKey())) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
    return session
  } catch {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
    return null
  }
}

export function saveAuthSession(session: DemoAuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export async function clearAuthSession(): Promise<void> {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
  } catch {
    // Continue clearing the IndexedDB vault.
  }

  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(VAULT_DATABASE)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

export function bindRole(
  session: DemoAuthSession,
  agreementId: string,
  role: PartyRole,
): DemoAuthSession {
  return {
    ...session,
    roleBindings: [
      ...session.roleBindings.filter((binding) => binding.agreementId !== agreementId),
      { agreementId, role },
    ],
  }
}

export function roleForAgreement(
  session: DemoAuthSession | null,
  agreementId: string,
): PartyRole | undefined {
  return session?.roleBindings.find((binding) => binding.agreementId === agreementId)?.role
}
