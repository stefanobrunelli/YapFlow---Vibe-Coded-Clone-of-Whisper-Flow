/**
 * WindowManager — BrowserWindow lifecycle, vibrancy, and focus management.
 *
 * Two windows:
 *   1. Main HUD — compact 400×56 pill, always-on-top, top-center of screen
 *   2. Settings — 640×520 full-page settings, standard macOS window
 */

import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'

export class WindowManager {
  private window: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null

  createWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { height: screenH } = primaryDisplay.workAreaSize
    const winW = 60
    const winH = 26
    const x = 24 // 24px from left edge
    const y = screenH - winH - 24 // 24px from bottom

    this.window = new BrowserWindow({
      width: winW,
      height: winH,
      resizable: false,
      x,
      y,

      // macOS floating appearance
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      visualEffectState: 'active',
      hasShadow: false, // REMOVED to disable macOS filling the background with white

      // Always visible over other apps, but as a floating panel
      alwaysOnTop: true,
      skipTaskbar: true,

      // No titleBarStyle — frame:false without hiddenInset means no traffic lights

      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    // Make window stay on top across fullscreen apps
    this.window.setAlwaysOnTop(true, 'floating', 1)
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // Load the renderer
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(process.env['ELECTRON_RENDERER_URL'])
      this.window.webContents.openDevTools({ mode: 'detach' })
    } else {
      this.window.loadFile(join(__dirname, '../renderer/index.html'))
    }

    this.window.webContents.on('will-navigate', (event) => {
      event.preventDefault()
    })

    this.window.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' }
    })

    // Prevent window from closing completely — hide instead
    this.window.on('close', (e) => {
      e.preventDefault()
      this.window?.hide()
    })

    return this.window
  }

  openSettingsWindow(): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.show()
      this.settingsWindow.focus()
      return
    }
    this.settingsWindow = this.createSettingsWindow()
  }

  private createSettingsWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize
    const winW = 640
    const winH = 520
    const x = Math.round((screenW - winW) / 2)
    const y = Math.round((screenH - winH) / 2)

    const win = new BrowserWindow({
      width: winW,
      height: winH,
      minWidth: 400,
      minHeight: 400,
      resizable: true,
      x,
      y,

      frame: false,
      transparent: true,
      vibrancy: 'window',
      visualEffectState: 'active',
      hasShadow: true,

      alwaysOnTop: false,
      skipTaskbar: false,

      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },

      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '?window=settings')
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { window: 'settings' }
      })
    }

    win.webContents.on('will-navigate', (event) => {
      event.preventDefault()
    })

    win.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' }
    })

    win.on('close', (e) => {
      e.preventDefault()
      win.hide()
    })

    win.on('closed', () => {
      this.settingsWindow = null
    })

    return win
  }

  closeSettingsWindow(): void {
    this.settingsWindow?.hide()
  }

  getWindow(): BrowserWindow | null {
    return this.window
  }

  getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow
  }

  show(): void {
    if (!this.window) return
    this.window.show()
    this.window.focus()
  }

  showInactive(): void {
    if (!this.window) return
    this.window.showInactive()
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

  resizeHud(width: number, height: number): void {
    if (!this.window) return
    const bounds = this.window.getBounds()
    
    const newX = bounds.x // left edge stays fixed; pill expands rightward
    // To keep it pinned to the bottom (y + height = bottomEdge), adjust y
    const newY = bounds.y + (bounds.height - height)

    this.window.setBounds({
      x: newX,
      y: newY,
      width,
      height
    }, true)
  }
}
