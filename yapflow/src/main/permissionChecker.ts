/**
 * PermissionChecker — macOS permission detection.
 *
 * Handles two types of macOS permissions:
 *   1. Microphone — handled by the renderer via getUserMedia browser API.
 *      The OS shows a permission dialog automatically on first call.
 *   2. Accessibility — required for auto-paste (AppleScript Cmd+V).
 *      Also required by uiohook-napi for Input Monitoring.
 *
 * Note: We cannot programmatically grant permissions — only check and prompt.
 * The user must manually allow in System Settings > Privacy & Security.
 */

import { systemPreferences, shell } from 'electron'
import { PermissionStatus } from '../shared/types'

export class PermissionChecker {
  /** Get the current status of all required permissions. */
  async getPermissionStatus(): Promise<PermissionStatus> {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone') as
      | 'granted'
      | 'denied'
      | 'not-determined'
      | 'restricted'

    const accessibilityGranted = systemPreferences.isTrustedAccessibilityClient(false)

    return {
      microphone:
        micStatus === 'granted'
          ? 'granted'
          : micStatus === 'denied' || micStatus === 'restricted'
          ? 'denied'
          : 'not-determined',
      accessibility: accessibilityGranted
    }
  }

  /**
   * Request Accessibility permission.
   * This opens a System Preferences dialog prompting the user to add the app.
   * The app must be restarted after the user grants permission.
   */
  requestAccessibility(): void {
    // Passing `true` triggers the macOS permission dialog
    systemPreferences.isTrustedAccessibilityClient(true)
  }

  /**
   * Request microphone access. Returns the new status.
   * On macOS, this is typically handled by the browser's getUserMedia call,
   * but we can also trigger it explicitly from the main process.
   */
  async requestMicrophoneAccess(): Promise<boolean> {
    const granted = await systemPreferences.askForMediaAccess('microphone')
    return granted
  }

  /**
   * Open the Privacy & Security > Accessibility panel in System Settings.
   * Useful if the user denied access and needs to re-enable it.
   */
  openAccessibilitySettings(): void {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
  }

  openMicrophoneSettings(): void {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone')
  }
}
