/**
 * SettingsModal — App configuration dialog.
 *
 * Uses @headlessui/react Dialog for accessible modal behavior.
 * Sections: API Key → Rewrite Mode → General
 */

import { useState, useCallback, useEffect } from 'react'
import { Dialog } from '@headlessui/react'
import { ApiKeyStatus, AppSettings, PermissionStatus } from '@shared/types'
import { ApiKeySection } from './ApiKeySection'
import { GroqKeySection } from './GroqKeySection'
import { RewriteModeSection } from './RewriteModeSection'
import { GeneralSection } from './GeneralSection'
import { Button } from '../shared/Button'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AppSettings
  hasApiKey: boolean
  apiKeyStatus: ApiKeyStatus
  permissions: PermissionStatus
  onSave: (settings: AppSettings, apiKey?: string) => Promise<void>
  onRefreshApiKey: () => Promise<void>
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  hasApiKey,
  apiKeyStatus,
  permissions,
  onSave,
  onRefreshApiKey
}: SettingsModalProps) {
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [version, setVersion] = useState<string>('')

  // Reset draft to latest settings every time the modal opens.
  // Also load the app version on first open.
  useEffect(() => {
    if (!isOpen) return
    setDraft(settings)
    if (!version) window.api.getAppVersion().then(setVersion)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((partial: Partial<AppSettings>) => {
    setDraft((prev) => ({ ...prev, ...partial }))
  }, [])

  const handleSaveApiKey = useCallback(
    async (key: string) => {
      await onSave(draft, key)
      await onRefreshApiKey()
    },
    [draft, onSave, onRefreshApiKey]
  )

  const handleApply = async () => {
    await onSave(draft)
    onClose()
  }

  const handleClearHistory = async () => {
    if (window.confirm('Clear all history? This cannot be undone.')) {
      await window.api.clearHistory()
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="no-drag w-full max-w-sm rounded-xl border border-white/15 shadow-2xl overflow-hidden"
          style={{ background: 'var(--panel-bg)', backdropFilter: 'blur(24px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/8">
            <Dialog.Title className="text-sm font-semibold text-white/90">
              Settings
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-white/35 hover:text-white/70 transition-colors cursor-pointer p-1 rounded-md hover:bg-white/8"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
            <ApiKeySection
              hasApiKey={hasApiKey}
              apiKeyStatus={apiKeyStatus}
              onSave={handleSaveApiKey}
            />

            <div className="h-px bg-white/8" />

            <GroqKeySection />

            <div className="h-px bg-white/8" />

            <RewriteModeSection
              settings={draft}
              activeMode={draft.rewriteMode}
              onChange={handleChange}
              onApply={handleApply}
            />

            <div className="h-px bg-white/8" />

            <GeneralSection
              settings={draft}
              permissions={permissions}
              onChange={handleChange}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/8">
            <div className="flex items-center gap-2">
              <Button variant="danger" size="sm" onClick={handleClearHistory}>
                Clear History
              </Button>
              {version && (
                <span className="text-[10px] text-white/25">v{version}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
