/**
 * ShortcutManager — Global hold-to-record keyboard detection.
 *
 * Main-process proxy around a utilityProcess child that owns `uiohook-napi`.
 * The native hook has a pthread bug that can deadlock the process hosting it;
 * by running the hook in a separate OS process we can SIGKILL and respawn it
 * without freezing the Electron main thread. See `hookChild.ts` for details.
 *
 * Public API (unchanged from the in-process version):
 *   start / stop / restart / resetState / updateShortcut / updateBehavior
 *   startCapture / stopCapture
 * Added:
 *   kill — force-SIGKILL the child and mark dead; used on before-quit and
 *   when the liveness pinger detects the child is wedged.
 *
 * Capture mode:
 *   Call startCapture() to record the next combo; the peak combo is emitted
 *   as SHORTCUT_CAPTURED once all keys are released.
 */

import { utilityProcess, type UtilityProcess } from 'electron'
import { join, sep } from 'path'
import { IPC } from '../shared/constants'
import { ShortcutBehavior, ShortcutConfig } from '../shared/types'
import {
  normalizeShortcutKeyCode,
  normalizeShortcutKeyCodes,
  withFormattedShortcutDisplay
} from '../shared/shortcutDisplay'
import type { HookChildMsg, HookParentMsg } from '../shared/hookIpc'
import { WindowManager } from './windowManager'
import { Logger } from './logger'

type ChildState = 'idle' | 'starting' | 'ready' | 'unresponsive' | 'dead'

const START_ATTEMPT_TIMEOUT_MS = 5000
const START_RETRY_DELAYS_MS = [0, 1000, 3500, 8000]
const PING_INTERVAL_MS = 2000
const LIVENESS_TIMEOUT_MS = 6000

export class ShortcutManager {
  private windowManager: WindowManager
  private logger: Logger

  private heldKeys = new Set<number>()
  private comboActive = false
  private shortcutKeyCodes: Set<number>
  private shortcutBehavior: ShortcutBehavior
  private toggleLatch = false

  // Capture mode state
  private captureMode = false
  private capturedKeys = new Set<number>()
  private peakCombo: number[] = []

  // Child process lifecycle
  private child: UtilityProcess | null = null
  private childState: ChildState = 'idle'
  private startPromise: Promise<void> | null = null
  private pendingStartResolve: (() => void) | null = null
  private pendingStartReject: ((err: Error) => void) | null = null
  private pendingStopResolve: (() => void) | null = null

  // Liveness tracking
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private lastPongAt = 0
  private pingId = 0

  constructor(
    windowManager: WindowManager,
    initialShortcut: ShortcutConfig,
    initialBehavior: ShortcutBehavior,
    logger: Logger
  ) {
    this.windowManager = windowManager
    this.logger = logger
    this.shortcutKeyCodes = new Set(normalizeShortcutKeyCodes(initialShortcut.keyCodes))
    this.shortcutBehavior = initialBehavior
  }

  // ─── Public lifecycle API ────────────────────────────────────────────────

  start(): void {
    void this.ensureRunning().catch((err) => {
      this.logger.logError('shortcutManager.start', err)
    })
  }

  /**
   * Tell the child to stop the native hook but keep the child alive. Used
   * pre-sleep so the hook releases cleanly before macOS suspends — reduces
   * the post-wake failure surface (the mutex bug is most likely to trip when
   * hook_run() fails on resume). The child stays ready to restart on wake.
   */
  stop(): void {
    this.stopPinger()
    if (!this.child || this.childState === 'dead') return
    this.postToChild({ type: 'stop' })
    // Best-effort — no need to await here, the main process is usually
    // shutting down or suspending when stop() is called
  }

  /**
   * Hard restart: SIGKILL the child and spawn a new one. Used on wake/unlock
   * and whenever the liveness pinger flags the child as unresponsive.
   */
  restart(): void {
    this.logger.logInfo('shortcutManager: restart', { fromState: this.childState })
    this.kill()
    this.start()
  }

  /**
   * Force-terminate the child process. SIGKILL is necessary because if the
   * child is wedged inside uiohook's native code, SIGTERM's JS handler will
   * never run.
   */
  kill(): void {
    this.stopPinger()
    if (this.child) {
      try {
        this.child.kill()
      } catch (err) {
        this.logger.logError('shortcutManager.kill', err)
      }
      this.child = null
    }
    this.childState = 'dead'
    this.rejectPendingStart(new Error('child killed'))
    this.startPromise = null
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

  // ─── Child lifecycle ─────────────────────────────────────────────────────

  private ensureRunning(): Promise<void> {
    if (this.childState === 'ready' && this.child) return Promise.resolve()
    if (this.startPromise) return this.startPromise
    this.startPromise = this.attemptStartWithRetries()
    return this.startPromise
  }

  private async attemptStartWithRetries(): Promise<void> {
    let lastError: Error | null = null
    for (let i = 0; i < START_RETRY_DELAYS_MS.length; i++) {
      const delay = START_RETRY_DELAYS_MS[i]
      if (delay > 0) await sleep(delay)
      try {
        await this.singleStartAttempt()
        this.startPromise = null
        this.startPinger()
        this.logger.logInfo('shortcutManager: child ready', { attempt: i + 1 })
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        this.logger.logInfo('shortcutManager: start attempt failed', {
          attempt: i + 1,
          message: lastError.message
        })
        // Ensure any partially-started child is killed before the next attempt
        this.killChildProcess()
      }
    }
    this.startPromise = null
    throw lastError ?? new Error('all start attempts exhausted')
  }

  private singleStartAttempt(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.forkChild()
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
        return
      }

      this.childState = 'starting'
      this.pendingStartResolve = resolve
      this.pendingStartReject = reject

      const timer = setTimeout(() => {
        if (this.pendingStartReject) {
          const r = this.pendingStartReject
          this.pendingStartResolve = null
          this.pendingStartReject = null
          r(new Error('child start timed out (likely wedged in native)'))
        }
      }, START_ATTEMPT_TIMEOUT_MS)

      // Clear the timer when either resolve or reject fires
      const origResolve = this.pendingStartResolve
      const origReject = this.pendingStartReject
      this.pendingStartResolve = () => {
        clearTimeout(timer)
        origResolve?.()
      }
      this.pendingStartReject = (err) => {
        clearTimeout(timer)
        origReject?.(err)
      }

      this.postToChild({ type: 'start' })
    })
  }

  private forkChild(): void {
    if (this.child) return
    // In a packaged app, __dirname points inside app.asar. utilityProcess.fork()
    // needs a real filesystem path, so rewrite to the asar.unpacked equivalent
    // (electron-builder.yml unpacks out/main/hookChild.js). In dev __dirname is
    // already a real directory on disk, so the replace is a no-op.
    const modulePath = join(__dirname, 'hookChild.js').replace(
      `${sep}app.asar${sep}`,
      `${sep}app.asar.unpacked${sep}`
    )
    this.logger.logInfo('shortcutManager: forking hook child', { modulePath })
    this.child = utilityProcess.fork(modulePath, [], { stdio: 'pipe' })
    this.child.on('message', (msg: HookChildMsg) => this.handleChildMessage(msg))
    this.child.on('exit', (code) => this.handleChildExit(code))
    this.child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trimEnd()
      if (text) this.logger.logHook('[hook]', text)
    })
    this.child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trimEnd()
      if (text) this.logger.logHook('[hook:out]', text)
    })
    this.lastPongAt = Date.now()
  }

  private killChildProcess(): void {
    if (this.child) {
      try {
        this.child.kill()
      } catch {
        // ignore
      }
      this.child = null
    }
    this.childState = 'dead'
  }

  private handleChildMessage(msg: HookChildMsg): void {
    switch (msg.type) {
      case 'keydown':
        this.handleKeydown(msg.keycode)
        return
      case 'keyup':
        this.handleKeyup(msg.keycode)
        return
      case 'pong':
        this.lastPongAt = Date.now()
        return
      case 'started':
        this.childState = 'ready'
        this.lastPongAt = Date.now()
        this.pendingStartResolve?.()
        this.pendingStartResolve = null
        this.pendingStartReject = null
        return
      case 'startFailed':
        this.rejectPendingStart(new Error(msg.message))
        return
      case 'stopped':
        this.pendingStopResolve?.()
        this.pendingStopResolve = null
        return
    }
  }

  private handleChildExit(code: number | null): void {
    this.logger.logInfo('shortcutManager: child exited', { code })
    this.child = null
    this.childState = 'dead'
    this.stopPinger()
    this.rejectPendingStart(new Error(`child exited (code ${code})`))
  }

  private rejectPendingStart(err: Error): void {
    if (this.pendingStartReject) {
      const r = this.pendingStartReject
      this.pendingStartResolve = null
      this.pendingStartReject = null
      r(err)
    }
  }

  private postToChild(msg: HookParentMsg): void {
    if (!this.child) return
    try {
      this.child.postMessage(msg)
    } catch (err) {
      this.logger.logError('shortcutManager.postToChild', err)
    }
  }

  // ─── Liveness pinger ─────────────────────────────────────────────────────

  private startPinger(): void {
    this.stopPinger()
    this.lastPongAt = Date.now()
    this.pingTimer = setInterval(() => this.tick(), PING_INTERVAL_MS)
  }

  private stopPinger(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private tick(): void {
    if (!this.child || this.childState !== 'ready') return
    const silence = Date.now() - this.lastPongAt
    if (silence > LIVENESS_TIMEOUT_MS) {
      this.logger.logInfo('shortcutManager: child unresponsive — respawning', {
        silenceMs: silence
      })
      this.childState = 'unresponsive'
      this.stopPinger()
      this.killChildProcess()
      // Kick off a respawn. Any concurrent caller will await the same promise.
      void this.ensureRunning().catch((err) => {
        this.logger.logError('shortcutManager: respawn failed', err)
      })
      return
    }
    this.pingId = (this.pingId + 1) % 1e9
    this.postToChild({ type: 'ping', id: this.pingId })
  }

  // ─── Combo detection (unchanged logic, new event source) ─────────────────

  private handleKeydown(keycode: number): void {
    const normalizedKeyCode = normalizeShortcutKeyCode(keycode)

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

  private handleKeyup(keycode: number): void {
    const normalizedKeyCode = normalizeShortcutKeyCode(keycode)

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
