/**
 * TrayManager — macOS menu bar icon and context menu.
 *
 * Since PromptFlow Lite hides from the Dock by default, the tray is the
 * primary way to access the app and quit it.
 */

import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { WindowManager } from './windowManager'

export class TrayManager {
  private tray: Tray | null = null
  private windowManager: WindowManager

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager
  }

  create(): void {
    // Use a template image for automatic dark/light mode adaptation on macOS.
    // Template images must be named *Template.png
    const iconPath = join(__dirname, '../../resources/trayIconTemplate.png')
    let icon: Electron.NativeImage

    try {
      icon = nativeImage.createFromPath(iconPath)
      if (icon.isEmpty()) {
        // Fallback: create a minimal 16x16 icon programmatically
        icon = nativeImage.createEmpty()
      }
    } catch {
      icon = nativeImage.createEmpty()
    }

    this.tray = new Tray(icon)
    this.tray.setToolTip('PromptFlow Lite')
    this.updateMenu()

    // Click on tray icon → toggle window
    this.tray.on('click', () => {
      this.windowManager.toggleVisibility()
    })
  }

  updateMenu(): void {
    if (!this.tray) return

    const menu = Menu.buildFromTemplate([
      {
        label: 'Show PromptFlow Lite',
        click: () => this.windowManager.show()
      },
      { type: 'separator' },
      {
        label: 'Shortcut: ⌘⌥Space (hold)',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Quit PromptFlow Lite',
        accelerator: 'Command+Q',
        click: () => app.exit(0)
      }
    ])

    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
