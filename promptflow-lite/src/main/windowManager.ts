/**
 * WindowManager — BrowserWindow lifecycle, vibrancy, and focus management.
 *
 * Creates a floating, always-on-top, vibrancy-enabled window that sits
 * above other apps without stealing focus during auto-paste.
 */

import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export class WindowManager {
  private window: BrowserWindow | null = null

  createWindow(): BrowserWindow {
    // Position near center-top of the primary display
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenW } = primaryDisplay.workAreaSize
    const winW = 480
    const winH = 320
    const x = Math.round((screenW - winW) / 2)
    const y = 80 // near top of screen

    this.window = new BrowserWindow({
      width: winW,
      height: winH,
      minWidth: 380,
      minHeight: 260,
      x,
      y,

      // macOS floating appearance
      frame: false,
      transparent: true,
      vibrancy: 'hud', // dark frosted-glass effect
      visualEffectState: 'active',
      hasShadow: true,

      // Always visible over other apps, but as a floating panel
      alwaysOnTop: true,
      level: 'floating',
      skipTaskbar: true,

      // Native traffic lights (close/minimize/maximize) positioned nicely
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 10 },

      // Keep visible on all Spaces and full-screen apps
      visibleOnAllWorkspaces: true,

      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        // contextIsolation: true is the default and is critical for security.
        // It ensures the renderer cannot access Node.js/Electron internals.
        contextIsolation: true,
        nodeIntegration: false, // Never enable — security boundary
        sandbox: false // Required for preload to access contextBridge properly
      }
    })

    // Make window stay on top across fullscreen apps
    this.window.setAlwaysOnTop(true, 'floating', 1)
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // Load the renderer
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(process.env['ELECTRON_RENDERER_URL'])
      // Open DevTools on the side in development
      this.window.webContents.openDevTools({ mode: 'detach' })
    } else {
      this.window.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // Prevent window from closing completely — hide instead
    this.window.on('close', (e) => {
      e.preventDefault()
      this.window?.hide()
    })

    return this.window
  }

  getWindow(): BrowserWindow | null {
    return this.window
  }

  show(): void {
    if (!this.window) return
    this.window.show()
    this.window.focus()
  }

  hide(): void {
    this.window?.hide()
  }

  toggleVisibility(): void {
    if (this.window?.isVisible()) {
      this.hide()
    } else {
      this.show()
    }
  }

  /**
   * Temporarily make the window non-focusable.
   * Used during auto-paste so focus remains in the target app.
   */
  setFocusable(focusable: boolean): void {
    this.window?.setFocusable(focusable)
  }

  isVisible(): boolean {
    return this.window?.isVisible() ?? false
  }
}
