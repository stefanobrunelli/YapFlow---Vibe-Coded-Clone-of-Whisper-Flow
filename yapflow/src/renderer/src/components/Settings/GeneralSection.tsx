import { useEffect, useState } from 'react'
import { AppSettings, AppearanceMode, PermissionStatus, ShortcutConfig } from '@shared/types'
import { describeShortcutKeyCodes } from '@shared/shortcutDisplay'
import { Button } from '../shared/Button'
import { Toggle } from '../shared/Toggle'

interface GeneralSectionProps {
  settings: AppSettings
  permissions: PermissionStatus
  onChange: (partial: Partial<AppSettings>) => void
}

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

export function GeneralSection({ settings, permissions, onChange }: GeneralSectionProps) {
  // 'idle' → 'capturing' (waiting for keys) → 'confirming' (show captured + Save/Cancel)
  const [captureState, setCaptureState] = useState<'idle' | 'capturing' | 'confirming'>('idle')
  const [pendingShortcut, setPendingShortcut] = useState<ShortcutConfig | null>(null)

  const handleRequestAccessibility = async () => {
    await window.api.requestAccessibility()
    alert('Please restart YapFlow after granting Accessibility permission.')
  }

  const handleChangeShortcut = async () => {
    setPendingShortcut(null)
    setCaptureState('capturing')
    await window.api.startShortcutCapture()
  }

  const handleSaveShortcut = async () => {
    if (!pendingShortcut) return
    await window.api.saveShortcut(pendingShortcut)
    onChange({ shortcut: pendingShortcut })
    setPendingShortcut(null)
    setCaptureState('idle')
  }

  const handleCancelShortcut = async () => {
    await window.api.stopShortcutCapture()
    setPendingShortcut(null)
    setCaptureState('idle')
  }

  // Listen for the captured shortcut coming back from the main process
  useEffect(() => {
    if (captureState !== 'capturing') return
    const unsub = window.api.onShortcutCaptured((config) => {
      setPendingShortcut(config)
      setCaptureState('confirming')
    })
    return unsub
  }, [captureState])

  return (
    <div className="flex flex-col gap-4">
      {/* Auto-paste */}
      <div className="flex flex-col gap-2">
        <div>
          <div className="text-xs font-medium text-white/80">Auto-paste</div>
          <div className="text-[10px] text-white/40 mt-0.5">
            When Accessibility is granted, the result is pasted into the frontmost text field and also kept in your clipboard.
          </div>
        </div>

        {/* Accessibility permission status */}
        <div className={`flex items-center justify-between p-2 rounded-lg border text-[10px] ${
          permissions.accessibility
            ? 'bg-green-500/8 border-green-500/20'
            : 'bg-yellow-500/8 border-yellow-500/20'
        }`}>
          <span className={permissions.accessibility ? 'text-green-400' : 'text-yellow-400/80'}>
            {permissions.accessibility
              ? '✓ Accessibility permission granted'
              : '⚠ Accessibility permission required for auto-paste'}
          </span>
          {!permissions.accessibility && (
            <Button variant="ghost" size="sm" onClick={handleRequestAccessibility}>
              Grant
            </Button>
          )}
        </div>
      </div>

      {/* Microphone status */}
      <div className={`flex items-center p-2 rounded-lg border text-[10px] ${
        permissions.microphone === 'granted'
          ? 'bg-green-500/8 border-green-500/20'
          : 'bg-red-500/8 border-red-500/20'
      }`}>
        <span className={permissions.microphone === 'granted' ? 'text-green-400' : 'text-red-400'}>
          {permissions.microphone === 'granted'
            ? '✓ Microphone access granted'
            : '✕ Microphone access required — record once to grant'}
        </span>
      </div>

      {/* Shortcut behavior */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-white/80">Shortcut Mode</div>
          <div className="text-[10px] text-white/40 mt-0.5">
            Hold to talk, or press once to start and again to stop
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          <button
            onClick={() => onChange({ shortcutBehavior: 'hold' })}
            className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
              settings.shortcutBehavior === 'hold'
                ? 'bg-white/20 text-white'
                : 'text-white/45 hover:text-white/70'
            }`}
          >
            Hold
          </button>
          <button
            onClick={() => onChange({ shortcutBehavior: 'toggle' })}
            className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
              settings.shortcutBehavior === 'toggle'
                ? 'bg-white/20 text-white'
                : 'text-white/45 hover:text-white/70'
            }`}
          >
            Toggle
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-white/80">Appearance</div>
          <div className="text-[10px] text-white/40 mt-0.5">
            Follow macOS, or force a readable light or dark theme
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          {APPEARANCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange({ appearanceMode: option.value })}
              className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                settings.appearanceMode === option.value
                  ? 'bg-white/20 text-white'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Draggable UI Info */}
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-4">
          <div className="text-xs font-medium text-white/80">Custom Positioning</div>
          <div className="text-[10px] text-white/40 mt-0.5 leading-relaxed">
            The main recording pill defaults to the bottom-left of your screen, but it can be dragged anywhere. It will securely remember your preferred location across app restarts. To move it, simply click and drag any gray area of the pill.
          </div>
        </div>
      </div>

      {/* Global shortcut */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-white/80">Global Shortcut</div>
            <div className="text-[10px] text-white/40 mt-0.5">Hold to record, release to process</div>
          </div>

          {/* Idle: show current shortcut + Change button */}
          {captureState === 'idle' && (
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded-md bg-white/8 border border-white/12 text-[11px] text-white/60 font-mono">
                {settings.shortcut?.display ?? '⌃⌥Space'}
              </kbd>
              <Button variant="ghost" size="sm" onClick={handleChangeShortcut}>
                Change
              </Button>
            </div>
          )}

          {/* Capturing: waiting for key press */}
          {captureState === 'capturing' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-blue-400 animate-pulse">Press keys…</span>
              <Button variant="ghost" size="sm" onClick={handleCancelShortcut}>
                Cancel
              </Button>
            </div>
          )}

          {/* Confirming: show captured keys + Save/Cancel */}
          {captureState === 'confirming' && pendingShortcut && (
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded-md bg-blue-500/20 border border-blue-400/30 text-[11px] text-blue-300 font-mono">
                {pendingShortcut.display}
              </kbd>
              <Button variant="ghost" size="sm" onClick={handleSaveShortcut}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancelShortcut}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        {captureState === 'capturing' && (
          <div className="text-[10px] text-white/30 px-1">
            Use at least 2 keys (e.g. a modifier + trigger). Press Cancel to keep the current shortcut.
          </div>
        )}

        <div className="text-[10px] text-white/35 px-1">
          Current shortcut: {describeShortcutKeyCodes(settings.shortcut.keyCodes)}
        </div>

        {pendingShortcut && captureState === 'confirming' && (
          <div className="text-[10px] text-blue-200/80 px-1">
            Captured: {describeShortcutKeyCodes(pendingShortcut.keyCodes)}
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[10px] text-white/40">
          The shortcut listener needs macOS Input Monitoring. If the shortcut never triggers, enable Input Monitoring
          for your terminal or the packaged app in System Settings.
        </div>
      </div>

      {/* Show in Dock */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-white/80">Show in Dock</div>
          <div className="text-[10px] text-white/40 mt-0.5">App restarts required to take effect</div>
        </div>
        <Toggle
          checked={settings.showInDock}
          onChange={(v) => onChange({ showInDock: v })}
          label="Show in Dock"
        />
      </div>
    </div>
  )
}
