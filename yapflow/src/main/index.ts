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

import { app, BrowserWindow, dialog, powerMonitor } from 'electron'
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
  windowManager = new WindowManager(settingsStore)
  windowManager.createWindow()

  // Create system tray icon + menu
  trayManager = new TrayManager(windowManager)
  trayManager.create()

  // Start listening for the global hold shortcut (uiohook-napi in-process).
  // Initialise with the saved shortcut (falls back to default ⌘⌥Space).
  shortcutManager = new ShortcutManager(
    windowManager,
    settings.shortcut ?? DEFAULT_SETTINGS.shortcut,
    settings.shortcutBehavior ?? DEFAULT_SETTINGS.shortcutBehavior,
    logger,
    {
      onAccessibilityDenied: () => {
        // uiohook-napi reports "Failed to enable access for assistive
        // devices" when the app isn't in Privacy & Security → Accessibility.
        // Without this dialog the app appears broken silently after launch.
        const res = dialog.showMessageBoxSync({
          type: 'warning',
          title: 'YapFlow needs Accessibility access',
          message: 'YapFlow needs Accessibility permission to listen for your global shortcut.',
          detail:
            'Open System Settings → Privacy & Security → Accessibility and enable YapFlow, then restart the app.',
          buttons: ['Open System Settings', 'Later'],
          defaultId: 0,
          cancelId: 1,
          noLink: true
        })
        if (res === 0) permissionChecker.openAccessibilitySettings()
      }
    }
  )
  try {
    shortcutManager.start()
  } catch (err) {
    // Accessibility denial surfaces here — the onAccessibilityDenied dialog
    // has already fired. Swallow so the app stays alive in the menu bar;
    // once the user grants permission and relaunches, start() will succeed.
    logger.logError('initial shortcutManager.start', err)
  }

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

  // macOS sleep/wake: uiohook's native Carbon event tap releases on suspend
  // and needs to be restarted on wake. Retry with backoff because macOS can
  // take a few seconds to restore Accessibility/Input Monitoring after wake.
  const restartHookOnWake = () => {
    void (async () => {
      const delaysMs = [1000, 3000, 8000]

      for (let i = 0; i < delaysMs.length; i++) {
        await sleep(delaysMs[i])
        try {
          shortcutManager.start()
          logger.logInfo('shortcutManager: restarted after wake', { attempt: i + 1 })
          return
        } catch (err) {
          logger.logError(`shortcutManager.restartOnWake attempt ${i + 1}`, err)
        }
      }

      logger.logInfo('shortcutManager: hook failed after wake retries, relaunching app')
      app.relaunch()
      app.quit()
    })()
  }

  const suspendHook = () => {
    shortcutManager.stop()
    shortcutManager.resetState()
    windowManager.getWindow()?.webContents.send('force-reset')
  }

  powerMonitor.on('suspend', suspendHook)
  powerMonitor.on('resume', restartHookOnWake)
  // Screen lock/unlock is separate from sleep on macOS (hot corner, Ctrl⌘Q).
  // The hook dies on lock too, so mirror the sleep handling.
  powerMonitor.on('lock-screen', suspendHook)
  powerMonitor.on('unlock-screen', restartHookOnWake)

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
  shortcutManager?.stop()
  trayManager?.destroy()
})

// On macOS it's common for applications to stay open even when all windows
// are closed. We keep the app running in the menu bar.
app.on('window-all-closed', () => {
  // Do nothing — we live in the menu bar
})
