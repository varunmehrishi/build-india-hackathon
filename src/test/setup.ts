import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { webcrypto } from 'node:crypto'
import { afterEach } from 'vitest'

Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: webcrypto,
})

const storageValues = new Map<string, string>()
const storage: Storage = {
  get length() { return storageValues.size },
  clear: () => storageValues.clear(),
  getItem: (key) => storageValues.get(key) ?? null,
  key: (index) => [...storageValues.keys()][index] ?? null,
  removeItem: (key) => storageValues.delete(key),
  setItem: (key, value) => storageValues.set(key, String(value)),
}

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

afterEach(() => {
  cleanup()
  localStorage.clear()
})
