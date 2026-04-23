/**
 * uiohook utilityProcess child — isolates the native global-hotkey hook.
 *
 * Runs in a separate OS process spawned by main via `utilityProcess.fork()`.
 * All communication flows over `process.parentPort`:
 *   parent → child: { type: 'start' | 'stop' | 'ping' }
 *   child → parent: { type: 'started' | 'startFailed' | 'stopped' | 'pong' | 'keydown' | 'keyup' }
 *
 * Why this lives in its own process:
 *   uiohook-napi 1.5.5 has a pthread ownership bug in its worker thread
 *   (unlocks a mutex owned by the caller thread). When hook_run() fails
 *   post-wake, the main thread blocks forever at uv_cond_wait with no timeout.
 *   A synchronous native call can't be cancelled from JS, so isolation is the
 *   only containment — parent SIGKILLs the child and respawns.
 */

import type { HookChildMsg, HookParentMsg } from '../shared/hookIpc'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { uIOhook } = require('uiohook-napi') as {
  uIOhook: {
    start: () => void
    stop: () => void
    on: (event: string, cb: (e: { keycode: number; type: number }) => void) => void
  }
}

declare const process: NodeJS.Process & {
  parentPort: {
    on: (event: 'message', cb: (msg: { data: HookParentMsg }) => void) => void
    postMessage: (msg: HookChildMsg) => void
  }
}

function send(msg: HookChildMsg): void {
  process.parentPort.postMessage(msg)
}

function log(line: string): void {
  // Parent streams stderr into the file logger. stdout is reserved for
  // diagnostic output in dev; all structured logs go through stderr.
  process.stderr.write(`${line}\n`)
}

let started = false

uIOhook.on('keydown', (event) => {
  send({ type: 'keydown', keycode: event.keycode })
})

uIOhook.on('keyup', (event) => {
  send({ type: 'keyup', keycode: event.keycode })
})

process.parentPort.on('message', (wrapper) => {
  const msg = wrapper.data
  switch (msg.type) {
    case 'start': {
      if (started) {
        send({ type: 'started' })
        return
      }
      try {
        uIOhook.start()
        started = true
        log('hook started')
        send({ type: 'started' })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log(`hook start failed: ${message}`)
        send({ type: 'startFailed', message })
      }
      return
    }
    case 'stop': {
      if (!started) {
        send({ type: 'stopped' })
        return
      }
      try {
        uIOhook.stop()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log(`hook stop threw: ${message}`)
      }
      started = false
      log('hook stopped')
      send({ type: 'stopped' })
      return
    }
    case 'ping': {
      send({ type: 'pong', id: msg.id })
      return
    }
  }
})

// No SIGTERM handler on purpose: Electron's utilityProcess.kill() sends
// SIGTERM, and Node's default action (kernel-level terminate) works even
// when the event loop is wedged inside uiohook native code. Installing a
// JS handler would queue behind the blocked loop and never run, defeating
// the whole point of process isolation. The OS reclaims the Core Graphics
// event tap on process exit.

log('hookChild ready')
