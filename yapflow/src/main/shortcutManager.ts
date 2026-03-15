/**
 * ShortcutManager — Global hold-to-record keyboard detection.
 *
 * Uses uiohook-napi to listen for raw keyboard events globally (even when
 * the app is not focused). Detects a configurable key combo being held down
 * and released, emitting events to the renderer via IPC.
 *
 * Why uiohook-napi instead of Electron's globalShortcut:
 *   - globalShortcut only fires on keydown, not keyup
 *   - uiohook-napi gives us both, enabling the "hold to record" UX
 *   - Requires Input Monitoring permission on macOS 10.15+
 *
 * Capture mode:
 *   Call startCapture() to enter a mode where the next key combo pressed
 *   is recorded and emitted as SHORTCUT_CAPTURED to the renderer.
 *   Call stopCapture() to cancel without recording.
 */

import { IPC } from '../shared/constants'
import { ShortcutBehavior, ShortcutConfig } from '../shared/types'
import {
  formatShortcutKeyCodes,
  normalizeShortcutKeyCode,
  normalizeShortcutKeyCodes,
  withFormattedShortcutDisplay
} from '../shared/shortcutDisplay'
import { WindowManager } from './windowManager'

// uiohook-napi is a native module — imported at runtime to avoid
// build-time issues when the native binary isn't yet compiled.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { uIOhook } = require('uiohook-napi') as {
  uIOhook: {
    start: () => void
    stop: () => void
    on: (event: string, cb: (e: UiohookKeyEvent) => void) => void
  }
}

interface UiohookKeyEvent {
  keycode: number
  type: number
}

export class ShortcutManager {
  private windowManager: WindowManager
  private heldKeys = new Set<number>()
  private comboActive = false
  private shortcutKeyCodes: Set<number>
  private shortcutBehavior: ShortcutBehavior
  private toggleLatch = false

  // Capture mode state
  private captureMode = false
  private capturedKeys = new Set<number>() // keys currently held during capture
  private peakCombo: number[] = []         // max combo held at once during capture

  constructor(
    windowManager: WindowManager,
    initialShortcut: ShortcutConfig,
    initialBehavior: ShortcutBehavior
  ) {
    this.windowManager = windowManager
    this.shortcutKeyCodes = new Set(normalizeShortcutKeyCodes(initialShortcut.keyCodes))
    this.shortcutBehavior = initialBehavior
  }

  start(): void {
    uIOhook.on('keydown', (event: UiohookKeyEvent) => {
      const normalizedKeyCode = normalizeShortcutKeyCode(event.keycode)

      if (this.captureMode) {
        this.capturedKeys.add(normalizedKeyCode)
        // Track the maximum combo (all keys held simultaneously)
        this.peakCombo = [...this.capturedKeys]
        return
      }

      this.heldKeys.add(normalizedKeyCode)

      if (!this.isComboActive()) {
        return
      }

      if (this.shortcutBehavior === 'toggle') {
        if (this.toggleLatch) {
          return
        }

        this.toggleLatch = true

        if (this.comboActive) {
          this.comboActive = false
          this.onComboEnd()
        } else {
          this.comboActive = true
          this.onComboStart()
        }
        return
      }

      if (!this.comboActive) {
        this.comboActive = true
        this.onComboStart()
      }
    })

    uIOhook.on('keyup', (event: UiohookKeyEvent) => {
      const normalizedKeyCode = normalizeShortcutKeyCode(event.keycode)

      if (this.captureMode) {
        this.capturedKeys.delete(normalizedKeyCode)

        // All keys released and we captured a meaningful combo (2+ keys)
        if (this.capturedKeys.size === 0 && this.peakCombo.length >= 2) {
          const config = withFormattedShortcutDisplay({ keyCodes: this.peakCombo, display: '' })
          this.captureMode = false
          this.peakCombo = []
          const win = this.windowManager.getSettingsWindow()
          win?.webContents.send(IPC.SHORTCUT_CAPTURED, config)
        }
        return
      }

      this.heldKeys.delete(normalizedKeyCode)

      if (this.shortcutBehavior === 'toggle') {
        if (!this.isComboActive()) {
          this.toggleLatch = false
        }
        return
      }

      if (
        this.comboActive &&
        this.shortcutKeyCodes.has(normalizedKeyCode)
      ) {
        // A key that's part of the combo was released — end recording
        this.comboActive = false
        this.heldKeys.clear()
        this.onComboEnd()
      }
    })

    uIOhook.start()
    console.log('[ShortcutManager] Started — listening for shortcut')
  }

  stop(): void {
    try {
      uIOhook.stop()
      console.log('[ShortcutManager] Stopped')
    } catch (err) {
      console.warn('[ShortcutManager] Error stopping uIOhook:', err)
    }
  }

  /** Update the active shortcut combo without restarting uiohook. */
  updateShortcut(config: ShortcutConfig): void {
    this.shortcutKeyCodes = new Set(normalizeShortcutKeyCodes(config.keyCodes))
    this.heldKeys.clear()
    this.comboActive = false
    this.toggleLatch = false
    console.log('[ShortcutManager] Shortcut updated to:', config.display)
  }

  updateBehavior(behavior: ShortcutBehavior): void {
    this.shortcutBehavior = behavior
    this.heldKeys.clear()
    this.comboActive = false
    this.toggleLatch = false
    console.log('[ShortcutManager] Shortcut behavior updated to:', behavior)
  }

  /** Enter capture mode: the next key combo pressed will be emitted as SHORTCUT_CAPTURED. */
  startCapture(): void {
    this.captureMode = true
    this.capturedKeys.clear()
    this.peakCombo = []
    this.heldKeys.clear()
    this.comboActive = false
    this.toggleLatch = false
    console.log('[ShortcutManager] Capture mode started')
  }

  /** Cancel capture mode without recording. */
  stopCapture(): void {
    this.captureMode = false
    this.capturedKeys.clear()
    this.peakCombo = []
    this.toggleLatch = false
    console.log('[ShortcutManager] Capture mode cancelled')
  }

  /** Returns true when all shortcut keys are currently held. */
  private isComboActive(): boolean {
    if (this.shortcutKeyCodes.size === 0) return false
    for (const key of this.shortcutKeyCodes) {
      if (!this.heldKeys.has(key)) return false
    }
    return true
  }

  private onComboStart(): void {
    console.log('[ShortcutManager] Combo start — recording begins')
    this.windowManager.showInactive()
    const win = this.windowManager.getWindow()
    win?.webContents.send(IPC.SHORTCUT_KEYDOWN)
  }

  private onComboEnd(): void {
    console.log('[ShortcutManager] Combo end — recording stops')
    const win = this.windowManager.getWindow()
    win?.webContents.send(IPC.SHORTCUT_KEYUP)
  }
}
