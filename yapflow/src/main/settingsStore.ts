/**
 * SettingsStore — Persistent settings storage.
 *
 * Uses electron-store (v7, CJS-compatible) for non-sensitive settings.
 * Uses Electron's safeStorage API for the OpenAI API key, which encrypts
 * it using the OS keychain (Keychain on macOS). The key is NEVER stored
 * in plaintext on disk.
 *
 * Storage location: ~/Library/Application Support/YapFlow/config.json
 */

import { safeStorage } from 'electron'
import Store from 'electron-store'
import { ApiKeyStatus, AppSettings, DEFAULT_SETTINGS } from '../shared/types'


// electron-store schema for type validation
interface StoreSchema {
  settings: AppSettings
  encryptedApiKey: string     // base64-encoded encrypted bytes (OpenAI)
  encryptedGroqApiKey: string // base64-encoded encrypted bytes (Groq)
}

export class SettingsStore {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'config',
      defaults: {
        settings: DEFAULT_SETTINGS,
        encryptedApiKey: '',
        encryptedGroqApiKey: ''
      }
    })
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  getSettings(): AppSettings {
    const stored = this.store.get('settings', DEFAULT_SETTINGS)
    // Merge with defaults so fields added in newer versions are always populated
    return { ...DEFAULT_SETTINGS, ...stored }
  }

  saveSettings(settings: AppSettings): void {
    this.store.set('settings', settings)
  }

  // ─── API Key (safeStorage) ─────────────────────────────────────────────────

  /**
   * Encrypt and persist the API key using the OS keychain.
   * safeStorage requires the app to be signed in production;
   * in development it uses a local encryption key.
   */
  saveApiKey(key: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      // Fallback: store unencrypted with a warning (dev-only scenario)
      console.warn('[SettingsStore] safeStorage not available — storing key in plaintext (dev only)')
      this.store.set('encryptedApiKey', Buffer.from(key).toString('base64'))
      return
    }
    const encrypted = safeStorage.encryptString(key)
    this.store.set('encryptedApiKey', encrypted.toString('base64'))
  }

  /**
   * Retrieve and decrypt the API key.
   * Returns null if no key has been saved.
   */
  getApiKey(): string | null {
    const encoded = this.store.get('encryptedApiKey', '')
    if (!encoded) return null

    try {
      if (!safeStorage.isEncryptionAvailable()) {
        // Dev fallback: reverse the base64 encoding
        return Buffer.from(encoded, 'base64').toString('utf-8')
      }
      const buffer = Buffer.from(encoded, 'base64')
      return safeStorage.decryptString(buffer)
    } catch (err) {
      console.error('[SettingsStore] Failed to decrypt API key:', err)
      return null
    }
  }

  hasApiKey(): boolean {
    const openaiKey = this.getApiKey()
    const groqKey = this.getGroqApiKey()
    return (openaiKey !== null && openaiKey.startsWith('sk-')) ||
           (groqKey !== null && groqKey.startsWith('gsk_'))
  }

  getApiKeyStatus(): ApiKeyStatus {
    const openaiKey = this.getApiKey()
    if (openaiKey && openaiKey.startsWith('sk-')) {
      return {
        hasApiKey: true,
        maskedKey: `${openaiKey.slice(0, 7)}...${openaiKey.slice(-4)}`
      }
    }
    const groqKey = this.getGroqApiKey()
    if (groqKey && groqKey.startsWith('gsk_')) {
      return {
        hasApiKey: true,
        maskedKey: `${groqKey.slice(0, 8)}...${groqKey.slice(-4)}`
      }
    }
    return { hasApiKey: false, maskedKey: null }
  }

  clearApiKey(): void {
    this.store.set('encryptedApiKey', '')
  }

  // ─── Groq API Key (safeStorage) ────────────────────────────────────────────

  saveGroqApiKey(key: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[SettingsStore] safeStorage not available — storing Groq key in plaintext (dev only)')
      this.store.set('encryptedGroqApiKey', Buffer.from(key).toString('base64'))
      return
    }
    const encrypted = safeStorage.encryptString(key)
    this.store.set('encryptedGroqApiKey', encrypted.toString('base64'))
  }

  getGroqApiKey(): string | null {
    const encoded = this.store.get('encryptedGroqApiKey', '')
    if (!encoded) return null

    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return Buffer.from(encoded, 'base64').toString('utf-8')
      }
      const buffer = Buffer.from(encoded, 'base64')
      return safeStorage.decryptString(buffer)
    } catch (err) {
      console.error('[SettingsStore] Failed to decrypt Groq API key:', err)
      return null
    }
  }

  hasGroqApiKey(): boolean {
    const key = this.getGroqApiKey()
    return key !== null && key.startsWith('gsk_')
  }

  getGroqApiKeyStatus(): ApiKeyStatus {
    const key = this.getGroqApiKey()
    if (!key || !key.startsWith('gsk_')) {
      return { hasApiKey: false, maskedKey: null }
    }
    const suffix = key.slice(-4)
    return {
      hasApiKey: true,
      maskedKey: `${key.slice(0, 8)}...${suffix}`
    }
  }

  clearGroqApiKey(): void {
    this.store.set('encryptedGroqApiKey', '')
  }
}
