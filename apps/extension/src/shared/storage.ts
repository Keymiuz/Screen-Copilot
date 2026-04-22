import type { PublicSettings, SettingsDraft } from './types'

const STORAGE_KEYS = {
  encryptedApiKey: 'mindside.googleApiKey.encrypted',
  googleModel: 'mindside.googleModel'
} as const

const DB_NAME = 'mindside-secure-settings'
const STORE_NAME = 'keys'
const KEY_ID = 'google-api-key'
const DEFAULT_MODEL = 'gemini-2.5-flash'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const bytes = base64ToBytes(value)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readCryptoKey(): Promise<CryptoKey | null> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(KEY_ID)

    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function writeCryptoKey(key: CryptoKey): Promise<void> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const request = transaction.objectStore(STORE_NAME).put(key, KEY_ID)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function getOrCreateCryptoKey(): Promise<CryptoKey> {
  const existing = await readCryptoKey()

  if (existing) {
    return existing
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt'
  ])
  await writeCryptoKey(key)

  return key
}

async function encryptSecret(value: string): Promise<string> {
  const key = await getOrCreateCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(value)
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded))

  return JSON.stringify({
    iv: bytesToBase64(iv),
    data: bytesToBase64(encrypted)
  })
}

async function decryptSecret(value: string): Promise<string> {
  if (!value) {
    return ''
  }

  try {
    const parsed = JSON.parse(value) as { iv: string; data: string }
    const key = await getOrCreateCryptoKey()
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToArrayBuffer(parsed.iv) },
      key,
      base64ToArrayBuffer(parsed.data)
    )

    return new TextDecoder().decode(decrypted)
  } catch {
    return ''
  }
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.encryptedApiKey, STORAGE_KEYS.googleModel])

  return {
    hasGoogleApiKey: Boolean(stored[STORAGE_KEYS.encryptedApiKey]),
    googleModel: String(stored[STORAGE_KEYS.googleModel] || DEFAULT_MODEL)
  }
}

export async function getSettingsDraft(): Promise<SettingsDraft> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.encryptedApiKey, STORAGE_KEYS.googleModel])

  return {
    googleApiKey: await decryptSecret(String(stored[STORAGE_KEYS.encryptedApiKey] || '')),
    googleModel: String(stored[STORAGE_KEYS.googleModel] || DEFAULT_MODEL)
  }
}

export async function saveSettings(draft: SettingsDraft): Promise<PublicSettings> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.encryptedApiKey]: draft.googleApiKey ? await encryptSecret(draft.googleApiKey) : '',
    [STORAGE_KEYS.googleModel]: draft.googleModel || DEFAULT_MODEL
  })

  return getPublicSettings()
}

export async function getGeminiConfig(): Promise<{ apiKey: string; model: string }> {
  const draft = await getSettingsDraft()

  return {
    apiKey: draft.googleApiKey,
    model: draft.googleModel || DEFAULT_MODEL
  }
}
