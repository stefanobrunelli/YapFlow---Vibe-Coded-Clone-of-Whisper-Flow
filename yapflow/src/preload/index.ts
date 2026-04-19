/**
 * Preload Script — Secure IPC Bridge.
 *
 * contextBridge.exposeInMainWorld() creates the ONLY communication channel
 * between the renderer (React) and the main process (Node.js/Electron).
 *
 * Security model:
 *   - contextIsolation: true  → renderer cannot access Node.js or Electron APIs
 *   - nodeIntegration: false  → renderer has no direct Node.js access
 *   - Every IPC channel that the renderer can call MUST be listed here
 *   - The renderer cannot call arbitrary IPC channels
 *
 * The window.api object is the COMPLETE interface the renderer has to the OS.
 */

import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/constants'
import type {
  TranscribeAudioPayload,
  TranscribeAudioResult,
  RewriteTextPayload,
  RewriteTextResult,
  AppSettings,
  SaveSettingsPayload,
  HistoryEntry,
  PermissionStatus,
  AppStatus,
  ShortcutConfig,
  ApiKeyStatus
} from '../shared/types'

// ─── Typed API surface ────────────────────────────────────────────────────────

const api = {
  // ── OpenAI pipeline ────────────────────────────────────────────────────────
  transcribeAudio: (payload: TranscribeAudioPayload): Promise<TranscribeAudioResult> =>
    ipcRenderer.invoke(IPC.TRANSCRIBE_AUDIO, payload),

  rewriteText: (payload: RewriteTextPayload): Promise<RewriteTextResult> =>
    ipcRenderer.invoke(IPC.REWRITE_TEXT, payload),

  saveHistoryEntry: (entry: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<HistoryEntry> =>
    ipcRenderer.invoke('save-history-entry', entry),

  testApiConnection: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('test-api-connection'),

  // ── Groq API Key ───────────────────────────────────────────────────────────
  saveGroqApiKey: (key: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('save-groq-api-key', key),

  getGroqApiKeyStatus: (): Promise<ApiKeyStatus> =>
    ipcRenderer.invoke('get-groq-api-key-status'),

  hasGroqApiKey: (): Promise<boolean> =>
    ipcRenderer.invoke('has-groq-api-key'),

  clearGroqApiKey: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('clear-groq-api-key'),

  testGroqConnection: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('test-groq-connection'),

  // ── Settings ───────────────────────────────────────────────────────────────
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.GET_SETTINGS),

  saveSettings: (payload: SaveSettingsPayload): Promise<void> =>
    ipcRenderer.invoke(IPC.SAVE_SETTINGS, payload),

  hasApiKey: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC.HAS_API_KEY),

  getApiKeyStatus: (): Promise<ApiKeyStatus> =>
    ipcRenderer.invoke('get-api-key-status'),

  // ── History ────────────────────────────────────────────────────────────────
  getHistory: (limit?: number): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke(IPC.GET_HISTORY, limit),

  deleteHistoryItem: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.DELETE_HISTORY_ITEM, id),

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke(IPC.CLEAR_HISTORY),

  // ── Permissions ────────────────────────────────────────────────────────────
  checkPermissions: (): Promise<PermissionStatus> =>
    ipcRenderer.invoke(IPC.CHECK_PERMISSIONS),

  requestAccessibility: (): Promise<void> =>
    ipcRenderer.invoke(IPC.REQUEST_ACCESSIBILITY),

  // ── Clipboard + auto-paste ─────────────────────────────────────────────────
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke(IPC.COPY_TO_CLIPBOARD, text),

  autoPasteText: (text: string): Promise<{ success: boolean; pasted: boolean }> =>
    ipcRenderer.invoke(IPC.AUTO_PASTE_TEXT, text),

  // ── Utility ────────────────────────────────────────────────────────────────
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),

  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke(IPC.GET_APP_VERSION),

  // ── Main → Renderer events (subscriptions) ─────────────────────────────────
  // Each returns an unsubscribe function for cleanup in React useEffect.

  onShortcutDown: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.SHORTCUT_KEYDOWN, listener)
    return () => ipcRenderer.removeListener(IPC.SHORTCUT_KEYDOWN, listener)
  },

  onShortcutUp: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.SHORTCUT_KEYUP, listener)
    return () => ipcRenderer.removeListener(IPC.SHORTCUT_KEYUP, listener)
  },

  onPermissionChanged: (cb: (status: PermissionStatus) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, status: PermissionStatus): void => cb(status)
    ipcRenderer.on(IPC.PERMISSION_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.PERMISSION_CHANGED, listener)
  },

  onProcessingState: (cb: (state: AppStatus | string) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, state: string): void => cb(state)
    ipcRenderer.on(IPC.PROCESSING_STATE, listener)
    return () => ipcRenderer.removeListener(IPC.PROCESSING_STATE, listener)
  },

  // ── Shortcut capture ────────────────────────────────────────────────────────
  startShortcutCapture: (): Promise<void> =>
    ipcRenderer.invoke(IPC.START_SHORTCUT_CAPTURE),

  stopShortcutCapture: (): Promise<void> =>
    ipcRenderer.invoke(IPC.STOP_SHORTCUT_CAPTURE),

  saveShortcut: (config: ShortcutConfig): Promise<void> =>
    ipcRenderer.invoke(IPC.SAVE_SHORTCUT, config),

  onShortcutCaptured: (cb: (config: ShortcutConfig) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, config: ShortcutConfig): void => cb(config)
    ipcRenderer.on(IPC.SHORTCUT_CAPTURED, listener)
    return () => ipcRenderer.removeListener(IPC.SHORTCUT_CAPTURED, listener)
  },

  onApiKeyChanged: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.API_KEY_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.API_KEY_CHANGED, listener)
  },

  onForceReset: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.FORCE_RESET, listener)
    return () => ipcRenderer.removeListener(IPC.FORCE_RESET, listener)
  },

  // ── Window management ──────────────────────────────────────────────────────
  openSettingsWindow: (): void => ipcRenderer.send(IPC.OPEN_SETTINGS_WINDOW),
  resizeHud: (width: number, height: number): void => ipcRenderer.send(IPC.RESIZE_HUD, width, height)
}

contextBridge.exposeInMainWorld('api', api)

// Export the type so the renderer can import it for TypeScript declarations
export type ElectronAPI = typeof api
