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
  normalizeShortcutKeyCode,
  normalizeShortcutKeyCodes,
  withFormattedShortcutDisplay
} from '../shared/shortcutDisplay'
import { WindowManager } from './windowManager'

// uiohook-napi is a native module — imported at runtime to avoid
// build-time issues when the native binary isn't yet compiled.
// eslint-disable-next-line @typescript-eslint/no-var-requires
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
  private listenersRegistered = false

  // Capture mode state
  private captureMode = false
  private capturedKeys = new Set<number>() // keys currently held during capture
  private peakCombo: number[] = []         // max combo held at once during capture

  // Sleep/wake recovery: pending delayed restart timers
  private pendingRestarts: ReturnType<typeof setTimeout>[] = []
  // Watchdog: periodic hook refresh to recover from silent hook death
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private static readonly WATCHDOG_INTERVAL_MS = 20 * 60 * 1000 // 20 minutes

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
    // Register listeners only once — re-calling start() after stop() reuses them
    if (!this.listenersRegistered) {
      uIOhook.on('keydown', (event: UiohookKeyEvent) => this.handleKeydown(event))
      uIOhook.on('keyup', (event: UiohookKeyEvent) => this.handleKeyup(event))
      this.listenersRegistered = true
    }
    uIOhook.start()
    this.startWatchdog()
    console.log('[ShortcutManager] Started — listening for shortcut')
  }

  stop(): void {
    this.stopWatchdog()
    this.pendingRestarts.forEach(t => clearTimeout(t))
    this.pendingRestarts = []
    try {
      uIOhook.stop()
      console.log('[ShortcutManager] Stopped')
    } catch (err) {
      console.warn('[ShortcutManager] Error stopping uIOhook:', err)
    }
  }

  /**
   * Restart the native hook after macOS sleep/wake or screen unlock.
   *
   * macOS needs time post-wake before it re-grants Input Monitoring access to
   * the native hook. A single immediate call reliably fails. We schedule four
   * attempts at increasing delays so at least one lands in the ready window.
   * Any in-flight retry chain is cancelled before starting a new one.
   */
  restart(): void {
    console.log('[ShortcutManager] Scheduling restart after wake/unlock')
    this.pendingRestarts.forEach(t => clearTimeout(t))
    this.pendingRestarts = []
    this.resetState()

    const delays = [100, 1000, 3500, 8000]
    delays.forEach(delay => {
      const t = setTimeout(() => {
        try { uIOhook.stop() } catch { /* already stopped */ }
        try {
          uIOhook.start()
          console.log(`[ShortcutManager] Hook restarted at +${delay}ms`)
        } catch (err) {
          console.warn(`[ShortcutManager] Restart failed at +${delay}ms:`, err)
        }
      }, delay)
      this.pendingRestarts.push(t)
    })
  }

  private startWatchdog(): void {
    this.stopWatchdog()
    this.watchdogTimer = setInterval(() => {
      console.log('[ShortcutManager] Watchdog: refreshing hook')
      try { uIOhook.stop() } catch { /* ignore */ }
      this.resetState()
      try { uIOhook.start() } catch (err) {
        console.warn('[ShortcutManager] Watchdog restart failed:', err)
      }
    }, ShortcutManager.WATCHDOG_INTERVAL_MS)
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  /** Clear all transient key/combo state without stopping the hook. */
  resetState(): void {
    this.heldKeys.clear()
    this.comboActive = false
    this.toggleLatch = false
    this.captureMode = false
    this.capturedKeys.clear()
    this.peakCombo = []
  }

  private handleKeydown(event: UiohookKeyEvent): void {
    const normalizedKeyCode = normalizeShortcutKeyCode(event.keycode)

    if (this.captureMode) {
      this.capturedKeys.add(normalizedKeyCode)
      this.peakCombo = [...this.capturedKeys]
      return
    }

    this.heldKeys.add(normalizedKeyCode)

    if (!this.isComboActive()) return

    if (this.shortcutBehavior === 'toggle') {
      if (this.toggleLatch) return
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
  }

  private handleKeyup(event: UiohookKeyEvent): void {
    const normalizedKeyCode = normalizeShortcutKeyCode(event.keycode)

    if (this.captureMode) {
      this.capturedKeys.delete(normalizedKeyCode)
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
      if (!this.isComboActive()) this.toggleLatch = false
      return
    }

    if (this.comboActive && this.shortcutKeyCodes.has(normalizedKeyCode)) {
      this.comboActive = false
      this.heldKeys.clear()
      this.onComboEnd()
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
