/**
 * YapFlow — Main Process Entry Point
 *
 * Architecture:
 *   1. Enforce single instance (prevent duplicate app windows)
 *   2. Initialize all managers in dependency order
 *   3. Wire up app lifecycle events
 *
 * Module initialization order matters:
 *   settingsStore → windowManager → trayManager → shortcutManager → ipcHandlers
 */

import { app, BrowserWindow, powerMonitor } from 'electron'
import { WindowManager } from './windowManager'
import { ShortcutManager } from './shortcutManager'
import { TrayManager } from './trayManager'
import { IpcHandlers } from './ipcHandlers'
import { SettingsStore } from './settingsStore'
import { DEFAULT_SETTINGS } from '../shared/types'
import { HistoryStore } from './historyStore'
import { OpenAIClient } from './openaiClient'
import { PermissionChecker } from './permissionChecker'
import { Logger } from './logger'
import { configureAppIdentity } from './appIdentity'

configureAppIdentity()

// ─── Single-instance lock ──────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  // Another instance is already running — bring it to front and quit this one
  app.quit()
}

// ─── Module instances ──────────────────────────────────────────────────────────

let windowManager: WindowManager
let trayManager: TrayManager
let shortcutManager: ShortcutManager
let ipcHandlers: IpcHandlers

// ─── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Open DevTools with F12 in development
  if (!app.isPackaged) {
    app.on('browser-window-created', (_, window) => {
      window.webContents.on('before-input-event', (_, input) => {
        if (input.type === 'keyDown' && input.key === 'F12') {
          window.webContents.openDevTools()
        }
      })
    })
  }

  // Initialize stores first (no UI dependencies)
  const settingsStore = new SettingsStore()
  const historyStore = new HistoryStore()
  const logger = new Logger()
  const openaiClient = new OpenAIClient(settingsStore, logger)
  const permissionChecker = new PermissionChecker()

  // Hide from Dock by default (menu-bar-only app)
  // Check user preference — show in Dock if they've opted in
  const settings = settingsStore.getSettings()
  if (!settings.showInDock) {
    app.dock?.hide()
  }

  // Create the floating window
  windowManager = new WindowManager()
  windowManager.createWindow()

  // Create system tray icon + menu
  trayManager = new TrayManager(windowManager)
  trayManager.create()

  // Start listening for the global hold shortcut.
  // Initialise with the saved shortcut (falls back to default ⌘⌥Space).
  // Must start AFTER app.whenReady()
  shortcutManager = new ShortcutManager(
    windowManager,
    settings.shortcut ?? DEFAULT_SETTINGS.shortcut,
    settings.shortcutBehavior ?? DEFAULT_SETTINGS.shortcutBehavior
  )
  shortcutManager.start()

  // Register all IPC handlers (must come after shortcutManager is created
  // so the shortcut capture handlers can reference it)
  ipcHandlers = new IpcHandlers(
    windowManager,
    settingsStore,
    historyStore,
    openaiClient,
    permissionChecker,
    logger,
    shortcutManager
  )
  ipcHandlers.register()

  // Second-instance handler — focus our window if user tries to open again
  app.on('second-instance', () => {
    windowManager.show()
  })

  // macOS sleep/wake: uiohook's native hook dies across sleep cycles.
  // On suspend, reset transient key state. On resume, restart the hook so
  // the shortcut works again without needing a manual app restart.
  powerMonitor.on('suspend', () => {
    shortcutManager.resetState()
    // Force the renderer back to idle in case it was mid-recording
    windowManager.getWindow()?.webContents.send('force-reset')
  })

  powerMonitor.on('resume', () => {
    shortcutManager.restart()
  })

  app.on('activate', () => {
    // macOS: re-create window if Dock icon is clicked and no windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow()
    } else {
      windowManager.show()
    }
  })
})

// ─── Quit handling ─────────────────────────────────────────────────────────────

app.on('before-quit', () => {
  // Stop uiohook before quitting to avoid native crashes
  shortcutManager?.stop()
  trayManager?.destroy()
})

// On macOS it's common for applications to stay open even when all windows
// are closed. We keep the app running in the menu bar.
app.on('window-all-closed', () => {
  // Do nothing — we live in the menu bar
})
