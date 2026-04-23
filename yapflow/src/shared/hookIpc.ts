/**
 * IPC contract between the Electron main process and the uiohook utilityProcess child.
 *
 * The child owns the native `uiohook-napi` module. Main process never loads the
 * native addon — if the native hook deadlocks post-wake (the pthread bug in
 * uiohook_worker.c), only the child wedges. Main SIGKILLs the child and respawns.
 */

export type HookParentMsg =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'ping'; id: number }

export type HookChildMsg =
  | { type: 'started' }
  | { type: 'startFailed'; message: string }
  | { type: 'stopped' }
  | { type: 'pong'; id: number }
  | { type: 'keydown'; keycode: number }
  | { type: 'keyup'; keycode: number }
