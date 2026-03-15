/**
 * AutoPaste — macOS Accessibility-powered auto-paste.
 *
 * Workflow:
 *   1. Write text to clipboard
 *   2. Temporarily disable focus on our HUD (setFocusable false) so the
 *      target app remains frontmost — we do NOT hide the window so the HUD
 *      stays visible throughout
 *   3. Wait briefly for the OS to settle
 *   4. Use AppleScript to simulate Cmd+V in the frontmost app
 *   5. Re-enable focus on the HUD
 *
 * Why we don't hide:
 *   The global shortcut fires via uiohook at OS level, so PromptFlow never
 *   becomes the frontmost application. The user's target app (VS Code, Notes,
 *   etc.) retains focus throughout recording + processing. There is no need
 *   to hide and re-show the HUD.
 *
 * Requires:
 *   - Accessibility permission (System Settings > Privacy > Accessibility)
 *   - entitlements.mac.plist: com.apple.security.automation.apple-events
 *
 * If Accessibility is not granted, this function skips the paste and
 * returns false. The caller should fall back to clipboard-only mode.
 */

import { clipboard, systemPreferences } from 'electron'
import { execSync } from 'child_process'
import { WindowManager } from './windowManager'
import { Logger } from './logger'

export class AutoPaste {
  private windowManager: WindowManager
  private logger: Logger

  constructor(windowManager: WindowManager, logger: Logger) {
    this.windowManager = windowManager
    this.logger = logger
  }

  /**
   * Copy text to clipboard and, if Accessibility is granted, paste it
   * into the currently active application.
   *
   * @returns true if paste succeeded, false if only copied (no Accessibility)
   */
  async paste(text: string): Promise<boolean> {
    // Step 1: Always copy to clipboard first
    clipboard.writeText(text)

    // Step 2: Check if we have Accessibility permission
    const hasAccessibility = systemPreferences.isTrustedAccessibilityClient(false)
    if (!hasAccessibility) {
      this.logger.logInfo('Auto-paste skipped: no Accessibility permission (clipboard-only mode)')
      return false
    }

    try {
      // Step 3: Disable focus so the HUD can't accidentally capture keystrokes
      this.windowManager.setFocusable(false)

      // Brief delay for the OS to register the focusable change
      await sleep(80)

      // Step 4: AppleScript Cmd+V — pastes into the frontmost app.
      // Since uiohook never activates PromptFlow, the target app retains
      // focus and this paste lands in the correct place.
      const script = `tell application "System Events" to keystroke "v" using command down`
      execSync(`osascript -e '${escapeSingleQuotes(script)}'`, {
        timeout: 3000
      })

      this.logger.logInfo('Auto-paste: success')

      // Step 5: Re-enable focus immediately — window stays visible throughout
      this.windowManager.setFocusable(true)

      return true
    } catch (err) {
      this.logger.logError('autoPaste', err)
      this.windowManager.setFocusable(true)
      return false
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function escapeSingleQuotes(str: string): string {
  // Safely embed a string in an osascript -e '...' invocation
  return str.replace(/'/g, "'\\''")
}
