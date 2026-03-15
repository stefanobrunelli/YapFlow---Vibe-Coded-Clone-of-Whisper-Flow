/**
 * TypeScript declaration for window.api
 *
 * This makes the contextBridge-exposed API fully typed in the renderer.
 * Import types from shared/types for complete type safety across the IPC boundary.
 */

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
} from '../../../shared/types'

declare global {
  interface Window {
    api: {
      transcribeAudio(payload: TranscribeAudioPayload): Promise<TranscribeAudioResult>
      rewriteText(payload: RewriteTextPayload): Promise<RewriteTextResult>
      saveHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<HistoryEntry>
      testApiConnection(): Promise<{ ok: boolean; error?: string }>

      getSettings(): Promise<AppSettings>
      saveSettings(payload: SaveSettingsPayload): Promise<void>
      hasApiKey(): Promise<boolean>
      getApiKeyStatus(): Promise<ApiKeyStatus>

      getHistory(limit?: number): Promise<HistoryEntry[]>
      deleteHistoryItem(id: string): Promise<void>
      clearHistory(): Promise<void>

      checkPermissions(): Promise<PermissionStatus>
      requestAccessibility(): Promise<void>

      copyToClipboard(text: string): Promise<void>
      autoPasteText(text: string): Promise<{ success: boolean; pasted: boolean }>

      openExternal(url: string): Promise<void>
      getAppVersion(): Promise<string>

      onShortcutDown(cb: () => void): () => void
      onShortcutUp(cb: () => void): () => void
      onPermissionChanged(cb: (status: PermissionStatus) => void): () => void
      onProcessingState(cb: (state: AppStatus | string) => void): () => void

      startShortcutCapture(): Promise<void>
      stopShortcutCapture(): Promise<void>
      saveShortcut(config: ShortcutConfig): Promise<void>
      onShortcutCaptured(cb: (config: ShortcutConfig) => void): () => void

      openSettingsWindow(): void
      resizeHud(width: number, height: number): void
    }
  }
}
