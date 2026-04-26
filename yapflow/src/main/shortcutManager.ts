/**
 * ShortcutManager — Global hold-to-record keyboard detection.
 *
 * Runs uiohook-napi IN THE MAIN PROCESS. An earlier revision isolated it in
 * a utilityProcess child, but that gave the child a separate bundle identity
 * (`com.yapflow.app.helper`) and macOS TCC denies Accessibility to it even
 * when the main app is granted. In-process matches v1.0 / v2.0.0 behavior,
 * which the user confirmed worked.
 *
 * Why uiohook-napi instead of Electron's globalShortcut:
 *   - globalShortcut only fires on keydown, not keyup.
 *   - uiohook-napi gives us both, enabling the "hold to record" UX.
 *   - Requires Accessibility + Input Monitoring on macOS.
 *
 * Sleep/wake: see index.ts power-monitor handlers. This class just exposes
 * start()/stop()/resetState() and lets the caller orchestrate timing.
 */

import { IPC } from '../shared/constants'
import { ShortcutBehavior, ShortcutConfig } from '../shared/types'
import {
  normalizeShortcutKeyCode,
  normalizeShortcutKeyCodes,
  withFormattedShortcutDisplay
} from '../shared/shortcutDisplay'
import { WindowManager } from './windowManager'
import { Logger } from './logger'

// uiohook-napi is a native module — imported at runtime via require() so the
// TS build doesn't trip over the prebuilt .node binary.
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

const ACCESSIBILITY_DENIED_MARKER = /assistive devices|accessibility api/i

export interface ShortcutManagerCallbacks {
  onAccessibilityDenied?: () => void
}

export class ShortcutManager {
  private windowManager: WindowManager
  private logger: Logger
  private callbacks: ShortcutManagerCallbacks

  private heldKeys = new Set<number>()
  private comboActive = false
  private shortcutKeyCodes: Set<number>
  private shortcutBehavior: ShortcutBehavior
  private toggleLatch = false
  private listenersRegistered = false
  private running = false
  private accessibilityDeniedNotified = false

  // Capture mode state
  private captureMode = false
  private capturedKeys = new Set<number>()
  private peakCombo: number[] = []

  constructor(
    windowManager: WindowManager,
    initialShortcut: ShortcutConfig,
    initialBehavior: ShortcutBehavior,
    logger: Logger,
    callbacks: ShortcutManagerCallbacks = {}
  ) {
    this.windowManager = windowManager
    this.logger = logger
    this.callbacks = callbacks
    this.shortcutKeyCodes = new Set(normalizeShortcutKeyCodes(initialShortcut.keyCodes))
    this.shortcutBehavior = initialBehavior
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return

    if (!this.listenersRegistered) {
      uIOhook.on('keydown', (event: UiohookKeyEvent) => this.handleKeydown(event))
      uIOhook.on('keyup', (event: UiohookKeyEvent) => this.handleKeyup(event))
      this.listenersRegistered = true
    }

    try {
      uIOhook.start()
      this.running = true
      this.logger.logInfo('shortcutManager: started')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.logError('shortcutManager.start', err)
      if (ACCESSIBILITY_DENIED_MARKER.test(message) && !this.accessibilityDeniedNotified) {
        this.accessibilityDeniedNotified = true
        try {
          this.callbacks.onAccessibilityDenied?.()
        } catch (cbErr) {
          this.logger.logError('shortcutManager.onAccessibilityDenied', cbErr)
        }
      }
      // Re-throw so the caller (index.ts power-monitor) can decide whether to
      // retry or relaunch the app. During initial startup the main app handler
      // swallows this — the dialog is the user-facing signal.
      throw err
    }
  }

  stop(): void {
    if (!this.running) return
    try {
      uIOhook.stop()
    } catch (err) {
      this.logger.logError('shortcutManager.stop', err)
    }
    this.running = false
    this.logger.logInfo('shortcutManager: stopped')
  }

  resetState(): void {
    this.heldKeys.clear()
    this.comboActive = false
    this.toggleLatch = false
    this.captureMode = false
    this.capturedKeys.clear()
    this.peakCombo = []
  }

  updateShortcut(config: ShortcutConfig): void {
    this.shortcutKeyCodes = new Set(normalizeShortcutKeyCodes(config.keyCodes))
    this.heldKeys.clear()
    this.comboActive = false
    this.toggleLatch = false
    this.logger.logInfo('shortcutManager: shortcut updated', { display: config.display })
  }

  updateBehavior(behavior: ShortcutBehavior): void {
    this.shortcutBehavior = behavior
    this.heldKeys.clear()
    this.comboActive = false
    this.toggleLatch = false
    this.logger.logInfo('shortcutManager: behavior updated', { behavior })
  }

  startCapture(): void {
    this.captureMode = true
    this.capturedKeys.clear()
    this.peakCombo = []
    this.heldKeys.clear()
    this.comboActive = false
    this.toggleLatch = false
    this.logger.logInfo('shortcutManager: capture mode started')
  }

  stopCapture(): void {
    this.captureMode = false
    this.capturedKeys.clear()
    this.peakCombo = []
    this.toggleLatch = false
    this.logger.logInfo('shortcutManager: capture mode cancelled')
  }

  // ─── Combo detection ──────────────────────────────────────────────────────

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

  private isComboActive(): boolean {
    if (this.shortcutKeyCodes.size === 0) return false
    for (const key of this.shortcutKeyCodes) {
      if (!this.heldKeys.has(key)) return false
    }
    return true
  }

  private onComboStart(): void {
    this.windowManager.showInactive()
    const win = this.windowManager.getWindow()
    win?.webContents.send(IPC.SHORTCUT_KEYDOWN)
  }

  private onComboEnd(): void {
    const win = this.windowManager.getWindow()
    win?.webContents.send(IPC.SHORTCUT_KEYUP)
  }
}
