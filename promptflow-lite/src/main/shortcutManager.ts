/**
 * ShortcutManager — Global hold-to-record keyboard detection.
 *
 * Uses uiohook-napi to listen for raw keyboard events globally (even when
 * the app is not focused). Detects the Cmd+Opt+Space combo being held down
 * and released, emitting events to the renderer via IPC.
 *
 * Why uiohook-napi instead of Electron's globalShortcut:
 *   - globalShortcut only fires on keydown, not keyup
 *   - uiohook-napi gives us both, enabling the "hold to record" UX
 *   - Requires Input Monitoring permission on macOS 10.15+
 *
 * Key code reference (macOS HID keycodes via uiohook-napi):
 *   MetaLeft  = 3675   (Cmd)
 *   AltLeft   = 3640   (Option)
 *   Space     = 57
 */

import { IPC, KEY_CODES } from '../shared/constants'
import { WindowManager } from './windowManager'

// uiohook-napi is a native module — imported at runtime to avoid
// build-time issues when the native binary isn't yet compiled.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { uIOhook, UiohookKey } = require('uiohook-napi') as {
  uIOhook: {
    start: () => void
    stop: () => void
    on: (event: string, cb: (e: UiohookKeyEvent) => void) => void
  }
  UiohookKey: Record<string, number>
}

interface UiohookKeyEvent {
  keycode: number
  type: number
}

// Keys that form the shortcut combo
const COMBO_KEYS = new Set([
  KEY_CODES.META_LEFT,
  KEY_CODES.META_RIGHT,
  KEY_CODES.ALT_LEFT,
  KEY_CODES.ALT_RIGHT,
  KEY_CODES.SPACE
])

export class ShortcutManager {
  private windowManager: WindowManager
  private heldKeys = new Set<number>()
  private comboActive = false

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager
  }

  start(): void {
    uIOhook.on('keydown', (event: UiohookKeyEvent) => {
      this.heldKeys.add(event.keycode)

      if (!this.comboActive && this.isComboActive()) {
        this.comboActive = true
        this.onComboStart()
      }
    })

    uIOhook.on('keyup', (event: UiohookKeyEvent) => {
      if (this.comboActive && COMBO_KEYS.has(event.keycode)) {
        // A key that's part of the combo was released — end recording
        this.comboActive = false
        this.heldKeys.clear()
        this.onComboEnd()
      } else {
        this.heldKeys.delete(event.keycode)
      }
    })

    uIOhook.start()
    console.log('[ShortcutManager] Started — listening for Cmd+Opt+Space')
  }

  stop(): void {
    try {
      uIOhook.stop()
      console.log('[ShortcutManager] Stopped')
    } catch (err) {
      console.warn('[ShortcutManager] Error stopping uIOhook:', err)
    }
  }

  /** Returns true when Cmd+Opt+Space are all currently held. */
  private isComboActive(): boolean {
    const hasMeta = this.heldKeys.has(KEY_CODES.META_LEFT) || this.heldKeys.has(KEY_CODES.META_RIGHT)
    const hasAlt = this.heldKeys.has(KEY_CODES.ALT_LEFT) || this.heldKeys.has(KEY_CODES.ALT_RIGHT)
    const hasSpace = this.heldKeys.has(KEY_CODES.SPACE)
    return hasMeta && hasAlt && hasSpace
  }

  private onComboStart(): void {
    console.log('[ShortcutManager] Combo start — recording begins')
    // Ensure the window is visible when recording starts
    this.windowManager.show()
    // Notify renderer to start MediaRecorder
    const win = this.windowManager.getWindow()
    win?.webContents.send(IPC.SHORTCUT_KEYDOWN)
  }

  private onComboEnd(): void {
    console.log('[ShortcutManager] Combo end — recording stops')
    // Notify renderer to stop MediaRecorder and begin transcription
    const win = this.windowManager.getWindow()
    win?.webContents.send(IPC.SHORTCUT_KEYUP)
  }
}
