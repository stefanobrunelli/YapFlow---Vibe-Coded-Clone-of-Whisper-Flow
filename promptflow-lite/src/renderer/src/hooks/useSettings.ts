/**
 * useSettings — Load and save app settings via IPC.
 */

import { useState, useEffect, useCallback } from 'react'
import { ApiKeyStatus, AppSettings, DEFAULT_SETTINGS } from '../../../shared/types'
import { withFormattedShortcutDisplay } from '@shared/shortcutDisplay'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({ hasApiKey: false, maskedKey: null })
  const [loading, setLoading] = useState(true)

  // Load settings on mount
  useEffect(() => {
    Promise.all([window.api.getSettings(), window.api.getApiKeyStatus()]).then(([s, status]) => {
      setSettings({ ...s, shortcut: withFormattedShortcutDisplay(s.shortcut) })
      setHasApiKey(status.hasApiKey)
      setApiKeyStatus(status)
      setLoading(false)
    })
  }, [])

  const saveSettings = useCallback(async (newSettings: AppSettings, apiKey?: string) => {
    await window.api.saveSettings({ settings: newSettings, apiKey })
    setSettings({ ...newSettings, shortcut: withFormattedShortcutDisplay(newSettings.shortcut) })
    if (apiKey !== undefined) {
      setHasApiKey(apiKey.startsWith('sk-'))
      setApiKeyStatus(await window.api.getApiKeyStatus())
    }
  }, [])

  const refreshApiKeyStatus = useCallback(async () => {
    const status = await window.api.getApiKeyStatus()
    setHasApiKey(status.hasApiKey)
    setApiKeyStatus(status)
  }, [])

  return { settings, hasApiKey, apiKeyStatus, loading, saveSettings, refreshApiKeyStatus }
}
