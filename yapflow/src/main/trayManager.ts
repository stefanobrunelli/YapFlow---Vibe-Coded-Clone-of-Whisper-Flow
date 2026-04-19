/**
 * TrayManager — macOS menu bar icon and context menu.
 *
 * Since YapFlow hides from the Dock by default, the tray is the
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
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'resources/whisperflow_tray_32x32.png')
      : join(__dirname, '../../resources/whisperflow_tray_32x32.png')
    let icon: Electron.NativeImage

    try {
      const source = nativeImage.createFromPath(iconPath)
      if (source.isEmpty()) {
        icon = nativeImage.createEmpty()
      } else {
        const buffer = source.resize({ width: 40, height: 40, quality: 'best' }).toPNG()
        icon = nativeImage.createEmpty()
        icon.addRepresentation({ scaleFactor: 2.0, buffer })
      }
    } catch {
      icon = nativeImage.createEmpty()
    }

    this.tray = new Tray(icon)
    this.tray.setToolTip(app.getName())
    this.updateMenu()
  }

  updateMenu(): void {
    if (!this.tray) return

    const menu = Menu.buildFromTemplate([
      {
        label: `Show ${app.getName()}`,
        click: () => this.windowManager.show()
      },
      {
        label: 'Settings...',
        accelerator: 'CmdOrCtrl+,',
        click: () => this.windowManager.openSettingsWindow()
      },
      { type: 'separator' },
      {
        label: 'Shortcut: ⌘⌥Space (hold)',
        enabled: false
      },
      { type: 'separator' },
      {
        label: `Quit ${app.getName()}`,
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
