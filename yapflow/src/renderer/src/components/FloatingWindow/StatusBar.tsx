/**
 * StatusBar — Mode selector tabs and current status text.
 */

import { AppStatus, RewriteMode, ShortcutBehavior } from '@shared/types'
import { describeShortcutKeyCodes } from '@shared/shortcutDisplay'

const MODES: { value: RewriteMode; label: string; desc: string }[] = [
  { value: 'raw', label: 'Raw', desc: 'Exact transcript' },
  { value: 'clean', label: 'Clean', desc: 'Polished text' },
  { value: 'prompt', label: 'AI Prompt', desc: 'Structured prompt' }
]

const STATUS_LABELS: Record<AppStatus, string> = {
  idle: 'Hold ⌘⌥Space to record',
  recording: 'Recording… release to stop',
  transcribing: 'Transcribing audio…',
  rewriting: 'Rewriting…',
  done: 'Copied to clipboard',
  error: 'Error — see below'
}

interface StatusBarProps {
  status: AppStatus
  activeMode: RewriteMode
  shortcutDisplay: string
  shortcutKeyCodes: number[]
  shortcutBehavior: ShortcutBehavior
  onModeChange: (mode: RewriteMode) => void
}

export function StatusBar({
  status,
  activeMode,
  shortcutDisplay,
  shortcutKeyCodes,
  shortcutBehavior,
  onModeChange
}: StatusBarProps) {
  const readableShortcut = describeShortcutKeyCodes(shortcutKeyCodes)
  const statusLabel =
    status === 'idle'
      ? shortcutBehavior === 'hold'
        ? `Hold ${readableShortcut} to record`
        : `Press ${readableShortcut} to start/stop`
      : status === 'recording'
      ? shortcutBehavior === 'hold'
        ? 'Recording… release to stop'
        : 'Recording… press shortcut again to stop'
      : STATUS_LABELS[status]

  return (
    <div className="flex flex-col items-center gap-2.5 w-full">
      {/* Mode selector */}
      <div className="flex items-center p-0.5 rounded-lg bg-white/8 border border-white/10 no-drag">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => onModeChange(mode.value)}
            title={mode.desc}
            className={`
              px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-150 cursor-pointer
              ${
                activeMode === mode.value
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/45 hover:text-white/70'
              }
            `}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Status text */}
      <p
        className={`text-[11px] font-medium transition-all duration-200 ${
          status === 'error'
            ? 'text-red-400'
            : status === 'done'
            ? 'text-green-400'
            : status === 'recording'
            ? 'text-red-400'
            : 'text-white/45'
        }`}
      >
        {statusLabel}
      </p>

      <p className="text-[10px] text-white/28">
        Shortcut shown as {shortcutDisplay}
      </p>

      <p className="text-[10px] text-white/28">
        {shortcutBehavior === 'hold'
          ? 'Recording starts while the shortcut is held down.'
          : 'Press once to start recording, then press the same shortcut again to stop.'}
      </p>
    </div>
  )
}
