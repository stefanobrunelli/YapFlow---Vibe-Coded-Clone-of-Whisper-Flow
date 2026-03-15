/**
 * RecordingOrb — The central animated element of the UI.
 *
 * States:
 *   idle        → Soft glowing ring, subtle pulse, mic icon
 *   recording   → Red pulsing orb with animated waveform bars
 *   transcribing→ Spinning gradient ring (indigo)
 *   rewriting   → Spinning gradient ring (purple)
 *   done        → Green check, fades to idle after timeout
 *   error       → Red warning icon
 *
 * compact mode: 28×28px orb used in the HUD pill (no waveform bars)
 */

import { AppStatus } from '@shared/types'

interface RecordingOrbProps {
  status: AppStatus
  compact?: boolean
  onClick?: () => void
}

export function RecordingOrb({ status, compact = false, onClick }: RecordingOrbProps) {
  const orbSize = compact ? 'w-6 h-6' : 'w-12 h-12'
  const iconSize = compact ? 14 : 20

  return (
    <div className="flex flex-col items-center gap-3 no-drag">
      {/* Outer glow ring */}
      <div className="relative flex items-center justify-center">
        {/* Pulse rings (recording state) */}
        {status === 'recording' && !compact && (
          <>
            <div
              className="absolute inset-0 rounded-full border border-red-500/30 animate-ping"
              style={{ animationDuration: '1.2s' }}
            />
          </>
        )}
        {status === 'recording' && compact && (
          <div
            className="absolute rounded-full border border-red-500/40 animate-ping"
            style={{ width: '16px', height: '16px', animationDuration: '1.2s' }}
          />
        )}

        {/* Main orb */}
        <button
          onClick={onClick}
          aria-label={status === 'idle' ? 'Hold ⌘⌥Space to record' : status}
          className={`
            relative z-10 ${orbSize} rounded-full flex items-center justify-center
            transition-all duration-300 cursor-default
            ${status === 'idle' ? 'bg-transparent hover:bg-white/10' : ''}
            ${status === 'recording' ? 'bg-transparent' : ''}
            ${status === 'transcribing' || status === 'rewriting' ? 'bg-white/8' : ''}
            ${status === 'done' ? 'bg-green-500/20' : ''}
            ${status === 'error' ? 'bg-red-500/20' : ''}
          `}
        >
          {/* Spinner ring for processing states */}
          {(status === 'transcribing' || status === 'rewriting') && (
            <div
              className={`absolute inset-0 rounded-full border-2 border-transparent animate-spin ${
                status === 'transcribing'
                  ? 'border-t-indigo-400/80 border-r-indigo-400/20'
                  : 'border-t-purple-400/80 border-r-purple-400/20'
              }`}
              style={{ animationDuration: '0.8s' }}
            />
          )}

          {/* Icon */}
          <OrbIcon status={status} size={iconSize} />
        </button>
      </div>

      {/* Waveform bars (recording state, non-compact only) */}
      {status === 'recording' && !compact && (
        <div className="flex items-center gap-[3px] h-4">
          {[0.4, 0.7, 1, 0.85, 0.6, 0.9, 0.5, 0.75, 0.45].map((intensity, i) => (
            <div
              key={i}
              className="w-[2px] bg-red-400/80 rounded-full"
              style={{
                height: `${intensity * 16}px`,
                animation: `waveform ${0.6 + i * 0.07}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OrbIcon({ status, size }: { status: AppStatus; size: number }) {
  if (status === 'idle') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-white/80">
        <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" fill="currentColor" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  if (status === 'recording') {
    const dotSize = size * 0.5
    return (
      <div
        className="rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"
        style={{ width: dotSize, height: dotSize }}
      />
    )
  }

  if (status === 'transcribing') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-indigo-300/80">
        <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }

  if (status === 'rewriting') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-purple-300/80">
        <path d="M12 3l1.5 3 3 1.5-3 1.5L12 12l-1.5-3L7.5 7.5l3-1.5L12 3z" fill="currentColor" opacity="0.8"/>
        <path d="M19 15l.75 1.5 1.5.75-1.5.75L19 19.5l-.75-1.5-1.5-.75 1.5-.75L19 15z" fill="currentColor" opacity="0.6"/>
        <path d="M5 12l.5 1 1 .5-1 .5L5 15l-.5-1-1-.5 1-.5L5 12z" fill="currentColor" opacity="0.6"/>
      </svg>
    )
  }

  if (status === 'done') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-green-400">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (status === 'error') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-red-400">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
    )
  }

  return null
}
