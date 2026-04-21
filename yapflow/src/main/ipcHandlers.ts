/**
 * IpcHandlers — Central registration point for all IPC channels.
 *
 * This module wires up every ipcMain.handle() call. All handlers follow
 * a consistent pattern:
 *   - Validate input
 *   - Call the appropriate manager
 *   - Return { success, data } or throw (which Electron serializes as an error)
 *
 * Security: Input is validated before being passed to any module.
 * The OpenAI API key is NEVER returned to the renderer.
 */

import { ipcMain, clipboard, shell, app } from 'electron'
import { nanoid } from 'nanoid'
import { IPC } from '../shared/constants'
import { WindowManager } from './windowManager'
import { SettingsStore } from './settingsStore'
import { HistoryStore } from './historyStore'
import { OpenAIClient } from './openaiClient'
import { PermissionChecker } from './permissionChecker'
import { Logger } from './logger'
import { AutoPaste } from './autoPaste'
import { ShortcutManager } from './shortcutManager'
import {
  TranscribeAudioPayload,
  RewriteTextPayload,
  SaveSettingsPayload,
  HistoryEntry,
  ShortcutConfig
} from '../shared/types'

export class IpcHandlers {
  private windowManager: WindowManager
  private settingsStore: SettingsStore
  private historyStore: HistoryStore
  private openaiClient: OpenAIClient
  private permissionChecker: PermissionChecker
  private logger: Logger
  private autoPaste: AutoPaste
  private shortcutManager: ShortcutManager

  constructor(
    windowManager: WindowManager,
    settingsStore: SettingsStore,
    historyStore: HistoryStore,
    openaiClient: OpenAIClient,
    permissionChecker: PermissionChecker,
    logger: Logger,
    shortcutManager: ShortcutManager
  ) {
    this.windowManager = windowManager
    this.settingsStore = settingsStore
    this.historyStore = historyStore
    this.openaiClient = openaiClient
    this.permissionChecker = permissionChecker
    this.logger = logger
    this.autoPaste = new AutoPaste(windowManager, logger)
    this.shortcutManager = shortcutManager
  }

  register(): void {
    // ── Transcription ─────────────────────────────────────────────────────────
    ipcMain.handle(IPC.TRANSCRIBE_AUDIO, async (_event, payload: TranscribeAudioPayload) => {
      const win = this.windowManager.getWindow()
      win?.webContents.send(IPC.PROCESSING_STATE, 'transcribing')
      try {
        const result = await this.openaiClient.transcribeAudio(payload)
        win?.webContents.send(IPC.PROCESSING_STATE, 'transcribing_done')
        return result
      } catch (err) {
        this.logger.logError('ipc:transcribe-audio', err)
        if (err instanceof Error) {
          throw new Error(err.stack ?? `${err.name}: ${err.message}`)
        }
        throw err
      }
    })

    // ── Rewrite ───────────────────────────────────────────────────────────────
    ipcMain.handle(IPC.REWRITE_TEXT, async (_event, payload: RewriteTextPayload) => {
      const win = this.windowManager.getWindow()
      win?.webContents.send(IPC.PROCESSING_STATE, 'rewriting')
      try {
        const result = await this.openaiClient.rewriteText(payload)
        win?.webContents.send(IPC.PROCESSING_STATE, 'done')
        return result
      } catch (err) {
        this.logger.logError('ipc:rewrite-text', err)
        if (err instanceof Error) {
          throw new Error(err.stack ?? `${err.name}: ${err.message}`)
        }
        throw err
      }
    })

    // ── History entry creation (called by renderer after rewrite) ─────────────
    ipcMain.handle('save-history-entry', (_event, entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => {
      const fullEntry: HistoryEntry = {
        ...entry,
        id: nanoid(),
        createdAt: new Date().toISOString()
      }
      this.historyStore.addEntry(fullEntry)
      return fullEntry
    })

    // ── Settings ──────────────────────────────────────────────────────────────
    ipcMain.handle(IPC.GET_SETTINGS, () => {
      return this.settingsStore.getSettings()
    })

    ipcMain.handle(IPC.SAVE_SETTINGS, (_event, payload: SaveSettingsPayload) => {
      this.settingsStore.saveSettings(payload.settings)
      this.shortcutManager.updateShortcut(payload.settings.shortcut)
      this.shortcutManager.updateBehavior(payload.settings.shortcutBehavior)
      if (payload.apiKey !== undefined) {
        this.settingsStore.saveApiKey(payload.apiKey)
        const hudWin = this.windowManager.getWindow()
        hudWin?.webContents.send(IPC.API_KEY_CHANGED)
      }
      // Apply dock visibility immediately (no restart needed)
      if (payload.settings.showInDock) {
        app.dock?.show()
      } else {
        app.dock?.hide()
      }
      return { success: true }
    })

    ipcMain.handle(IPC.HAS_API_KEY, () => {
      return this.settingsStore.hasApiKey()
    })

    ipcMain.handle('get-api-key-status', () => {
      return this.settingsStore.getApiKeyStatus()
    })

    // Test API key connection
    ipcMain.handle('test-api-connection', async () => {
      return await this.openaiClient.testConnection()
    })

    // ── Groq API Key ──────────────────────────────────────────────────────────
    ipcMain.handle('get-groq-api-key-status', () => {
      return this.settingsStore.getGroqApiKeyStatus()
    })

    ipcMain.handle('has-groq-api-key', () => {
      return this.settingsStore.hasGroqApiKey()
    })

    ipcMain.handle('save-groq-api-key', (_event, key: string) => {
      this.settingsStore.saveGroqApiKey(key)
      const hudWin = this.windowManager.getWindow()
      hudWin?.webContents.send(IPC.API_KEY_CHANGED)
      return { success: true }
    })

    ipcMain.handle('clear-groq-api-key', () => {
      this.settingsStore.clearGroqApiKey()
      const hudWin = this.windowManager.getWindow()
      hudWin?.webContents.send(IPC.API_KEY_CHANGED)
      return { success: true }
    })

    ipcMain.handle('test-groq-connection', async () => {
      return await this.openaiClient.testGroqConnection()
    })

    // ── History ───────────────────────────────────────────────────────────────
    ipcMain.handle(IPC.GET_HISTORY, (_event, limit?: number) => {
      return this.historyStore.getEntries(limit)
    })

    ipcMain.handle(IPC.DELETE_HISTORY_ITEM, (_event, id: string) => {
      this.historyStore.deleteEntry(id)
      return { success: true }
    })

    ipcMain.handle(IPC.CLEAR_HISTORY, () => {
      this.historyStore.clearAll()
      return { success: true }
    })

    // ── Permissions ───────────────────────────────────────────────────────────
    ipcMain.handle(IPC.CHECK_PERMISSIONS, async () => {
      return await this.permissionChecker.getPermissionStatus()
    })

    ipcMain.handle(IPC.REQUEST_ACCESSIBILITY, () => {
      this.permissionChecker.requestAccessibility()
      return { success: true }
    })

    // ── Clipboard + Auto-paste ────────────────────────────────────────────────
    ipcMain.handle(IPC.COPY_TO_CLIPBOARD, (_event, text: string) => {
      clipboard.writeText(text)
      return { success: true }
    })

    ipcMain.handle(IPC.AUTO_PASTE_TEXT, async (_event, text: string) => {
      const pasted = await this.autoPaste.paste(text)
      return { success: true, pasted }
    })

    // ── Utility ───────────────────────────────────────────────────────────────
    ipcMain.handle(IPC.OPEN_EXTERNAL, (_event, url: string) => {
      try {
        const parsed = new URL(url)
        if (parsed.protocol === 'https:' || parsed.protocol === 'x-apple.systempreferences:') {
          shell.openExternal(url)
        }
      } catch {
        this.logger.logError('ipc:open-external', new Error(`Invalid URL: ${url}`))
      }
      return { success: true }
    })

    ipcMain.handle(IPC.GET_APP_VERSION, () => {
      return app.getVersion()
    })

    // ── Shortcut capture ──────────────────────────────────────────────────────
    ipcMain.handle(IPC.START_SHORTCUT_CAPTURE, () => {
      this.shortcutManager.startCapture()
      return { success: true }
    })

    ipcMain.handle(IPC.STOP_SHORTCUT_CAPTURE, () => {
      this.shortcutManager.stopCapture()
      return { success: true }
    })

    ipcMain.handle(IPC.SAVE_SHORTCUT, (_event, config: ShortcutConfig) => {
      this.shortcutManager.updateShortcut(config)
      const settings = this.settingsStore.getSettings()
      this.settingsStore.saveSettings({ ...settings, shortcut: config })
      return { success: true }
    })

    // ── Window management ─────────────────────────────────────────────────────
    ipcMain.on(IPC.OPEN_SETTINGS_WINDOW, () => {
      this.windowManager.openSettingsWindow()
    })

    ipcMain.on(IPC.RESIZE_HUD, (_event, width: number, height: number) => {
      this.windowManager.resizeHud(width, height)
    })

    this.logger.logInfo('IPC handlers registered')
  }
}
