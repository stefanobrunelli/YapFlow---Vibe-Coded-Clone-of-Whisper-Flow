/**
 * useIPCListener — Subscribe to main-process events.
 *
 * Sets up event listeners for IPC events sent from the main process to the
 * renderer. All listeners are automatically cleaned up on component unmount.
 */

import { useEffect } from 'react'
import { PermissionStatus, AppStatus } from '../../../shared/types'

interface IPCListeners {
  onShortcutDown?: () => void
  onShortcutUp?: () => void
  onPermissionChanged?: (status: PermissionStatus) => void
  onProcessingState?: (state: AppStatus | string) => void
  onForceReset?: () => void
}

export function useIPCListener(listeners: IPCListeners): void {
  useEffect(() => {
    const cleanupFns: Array<() => void> = []

    if (listeners.onShortcutDown) {
      cleanupFns.push(window.api.onShortcutDown(listeners.onShortcutDown))
    }
    if (listeners.onShortcutUp) {
      cleanupFns.push(window.api.onShortcutUp(listeners.onShortcutUp))
    }
    if (listeners.onPermissionChanged) {
      cleanupFns.push(window.api.onPermissionChanged(listeners.onPermissionChanged))
    }
    if (listeners.onProcessingState) {
      cleanupFns.push(window.api.onProcessingState(listeners.onProcessingState))
    }
    if (listeners.onForceReset) {
      cleanupFns.push(window.api.onForceReset(listeners.onForceReset))
    }

    return () => {
      cleanupFns.forEach((fn) => fn())
    }
  }, [
    listeners.onShortcutDown,
    listeners.onShortcutUp,
    listeners.onPermissionChanged,
    listeners.onProcessingState,
    listeners.onForceReset
  ])
}
