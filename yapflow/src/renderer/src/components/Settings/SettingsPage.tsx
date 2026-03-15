/**
 * SettingsPage — Full-page settings for the dedicated settings window.
 *
 * Self-contained: owns its own settings state via useSettings().
 * Renders as a full macOS window with traffic light spacer + tab navigation.
 */

import { useState, useCallback, useEffect } from 'react'
import { PermissionStatus, AppSettings } from '@shared/types'
import { useSettings } from '../../hooks/useSettings'
import { ApiKeySection } from './ApiKeySection'
import { RewriteModeSection } from './RewriteModeSection'
import { GeneralSection } from './GeneralSection'
import { Button } from '../shared/Button'
import { HistoryItem } from '../History/HistoryItem'
import type { HistoryEntry } from '@shared/types'

type Tab = 'history' | 'general' | 'modes' | 'api'

const TABS: { id: Tab; label: string }[] = [
  { id: 'history', label: 'History' },
  { id: 'general', label: 'Settings' },
  { id: 'modes', label: 'Prompt Selector' },
  { id: 'api', label: 'API Key' }
]

export function SettingsPage() {
  const { settings, hasApiKey, apiKeyStatus, loading, saveSettings, refreshApiKeyStatus } = useSettings()
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [permissions, setPermissions] = useState<PermissionStatus>({ microphone: 'not-determined', accessibility: false })
  const [activeTab, setActiveTab] = useState<Tab>('history')
  const [version, setVersion] = useState<string>('')

  // Sync draft when settings load
  useEffect(() => {
    setDraft(settings)
  }, [settings])

  useEffect(() => {
    window.api.checkPermissions().then(setPermissions)
    window.api.getAppVersion().then(setVersion)
  }, [])

  const handleChange = useCallback((partial: Partial<AppSettings>) => {
    setDraft((prev) => ({ ...prev, ...partial }))
  }, [])

  const handleSaveApiKey = useCallback(
    async (key: string) => {
      await saveSettings(draft, key)
      await refreshApiKeyStatus()
    },
    [draft, saveSettings, refreshApiKeyStatus]
  )

  const handleApply = async () => {
    await saveSettings(draft)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="drag-region flex flex-col h-full overflow-hidden rounded-xl">
      {/* Title bar with traffic light spacer */}
      <div className="flex items-center px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
        <div className="w-16" /> {/* traffic light spacer */}
        <span className="text-sm font-semibold text-white/90 flex-1 text-center">Settings</span>
        {version && (
          <span className="text-[10px] text-white/25 w-16 text-right">v{version}</span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/8 no-drag shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 cursor-pointer
              ${
                activeTab === tab.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/45 hover:text-white/70 hover:bg-white/8'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto no-drag">
        {activeTab === 'api' && (
          <div className="p-5">
            <ApiKeySection
              hasApiKey={hasApiKey}
              apiKeyStatus={apiKeyStatus}
              onSave={handleSaveApiKey}
            />
          </div>
        )}

        {activeTab === 'modes' && (
          <div className="p-5">
            <RewriteModeSection
              settings={draft}
              activeMode={draft.rewriteMode}
              onChange={handleChange}
            />
          </div>
        )}

        {activeTab === 'general' && (
          <div className="p-5">
            <GeneralSection
              settings={draft}
              permissions={permissions}
              onChange={handleChange}
            />
          </div>
        )}

        {activeTab === 'history' && <HistoryTab />}
      </div>

      {/* Footer — only show Apply for non-history, non-api tabs */}
      {activeTab !== 'api' && activeTab !== 'history' && (
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/8 shrink-0 no-drag">
          <Button variant="ghost" size="sm" onClick={() => setDraft(settings)}>
            Reset
          </Button>
          <Button variant="primary" size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="flex items-center px-5 py-3 border-t border-white/8 shrink-0 no-drag">
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (window.confirm('Clear all history? This cannot be undone.')) {
                await window.api.clearHistory()
              }
            }}
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  )
}

function HistoryTab() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getHistory(100).then((data) => {
      setEntries(data)
      setLoading(false)
    })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await window.api.deleteHistoryItem(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <p className="text-sm text-white/35">No history yet</p>
        <p className="text-[11px] text-white/20">Hold ⌘⌥Space to start recording</p>
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-2">
      {entries.map((entry) => (
        <HistoryItem key={entry.id} entry={entry} onDelete={handleDelete} />
      ))}
    </div>
  )
}
