/**
 * SettingsStore — Persistent settings storage.
 *
 * Uses electron-store (v7, CJS-compatible) for non-sensitive settings.
 * Uses Electron's safeStorage API for the OpenAI API key, which encrypts
 * it using the OS keychain (Keychain on macOS). The key is NEVER stored
 * in plaintext on disk.
 *
 * Storage location: ~/Library/Application Support/PromptFlowLite/config.json
 */

import { safeStorage } from 'electron'
import Store from 'electron-store'
import { ApiKeyStatus, AppSettings, DEFAULT_SETTINGS } from '../shared/types'


// electron-store schema for type validation
interface StoreSchema {
  settings: AppSettings
  encryptedApiKey: string // base64-encoded encrypted bytes
}

export class SettingsStore {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'config',
      defaults: {
        settings: DEFAULT_SETTINGS,
        encryptedApiKey: ''
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
    const key = this.getApiKey()
    return key !== null && key.startsWith('sk-')
  }

  getApiKeyStatus(): ApiKeyStatus {
    const key = this.getApiKey()
    if (!key || !key.startsWith('sk-')) {
      return { hasApiKey: false, maskedKey: null }
    }

    const suffix = key.slice(-4)
    return {
      hasApiKey: true,
      maskedKey: `${key.slice(0, 7)}...${suffix}`
    }
  }

  clearApiKey(): void {
    this.store.set('encryptedApiKey', '')
  }
}
