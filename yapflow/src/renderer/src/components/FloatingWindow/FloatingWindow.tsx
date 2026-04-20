import { AppState, RewriteMode } from '@shared/types'
import { RecordingOrb } from './RecordingOrb'
import { useState, useEffect, useRef } from 'react'

const MODES: { value: RewriteMode; label: string }[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'clean', label: 'Clean' },
  { value: 'prompt', label: 'Prompt' }
]

interface FloatingWindowProps {
  state: AppState
  activeMode: RewriteMode
  onModeChange: (mode: RewriteMode) => void
  hasApiKey: boolean
}

export function FloatingWindow({ state, activeMode, onModeChange, hasApiKey }: FloatingWindowProps) {
  const { status } = state
  const [isHovered, setIsHovered] = useState(false)
  const [copiedError, setCopiedError] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isRecording = status === 'recording' || status === 'transcribing' || status === 'rewriting'
  const isExpanded = isHovered || isRecording || status === 'error'

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (!isHovered) setIsHovered(true)
  }

  const handleMouseLeave = () => {
    // 400ms debounce allows the macOS window animation (~250ms) to complete smoothly
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 400)
  }

  useEffect(() => {
    // Window bounds are +12px larger than inner dimensions so CSS drop-shadows aren't clipped
    let targetWidth = 60
    let targetHeight = 26

    if (status === 'error') {
      targetWidth = 276
      targetHeight = 112
    } else if (isRecording) {
      targetWidth = 72
      targetHeight = 42
    } else if (isHovered) {
      targetWidth = 210
      targetHeight = 46
    }

    // Add a slight delay before shrinking back to avoid "finicky" flickering
    // when moving mouse between the pill and the edge.
    const timeout = setTimeout(() => {
      window.api.resizeHud(targetWidth, targetHeight)
    }, isHovered ? 0 : 100)

    return () => clearTimeout(timeout)
  }, [status, isHovered])

  useEffect(() => {
    if (status !== 'error') {
      setCopiedError(false)
    }
  }, [status])

  const handleCopyError = async () => {
    const errorText = state.lastError || 'Processing Error'
    await window.api.copyToClipboard(errorText)
    setCopiedError(true)
    setTimeout(() => setCopiedError(false), 2000)
  }

  return (
    <div 
      className="w-full h-full flex items-center justify-center bg-[rgba(0,0,0,0.01)] overflow-visible"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`drag-region flex items-center justify-center transition-all duration-300 ease-in-out ring-0 outline-none ${
          isExpanded 
            ? !hasApiKey 
                ? 'w-[200px] h-[34px] rounded-full bg-red-500 border border-red-300' 
                : status === 'error'
                  ? 'w-[264px] min-h-[100px] rounded-[22px] backdrop-blur-md bg-[#4a4a4d]/95 border-[0.5px] border-white/60 px-2 py-2'
                  : 'w-[200px] h-[34px] rounded-full backdrop-blur-md bg-[#4a4a4d]/95 border-[0.5px] border-white/60' 
            : 'w-[48px] h-[14px] rounded-full border border-white/80 bg-[#1c1c1e]/80'
        }`}
      >
        {isExpanded ? (
          <div className={`w-full animate-in fade-in zoom-in-95 duration-200 ${status === 'error' ? 'flex flex-col gap-2' : 'flex items-center gap-2 justify-between px-1'}`}>
            {status === 'error' ? (
              <div className="flex flex-col w-full no-drag gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-red-300/80 font-semibold">
                    Error
                  </span>
                  <button
                    onClick={handleCopyError}
                    className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-white/70 hover:bg-white/12 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedError ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[10px] text-red-300 font-medium leading-relaxed whitespace-pre-wrap break-words select-text max-h-[56px] overflow-y-auto">
                  {state.lastError || 'Processing Error'}
                </p>
              </div>
            ) : status === 'done' ? (
              <div className="flex items-center w-full justify-center no-drag px-1">
                <span className="text-[14px] text-green-400 font-bold tracking-wide">✓</span>
              </div>
            ) : isRecording ? (
               <div className="flex items-center justify-center w-full h-full">
                 <RecordingOrb status={status} compact />
               </div>
            ) : !hasApiKey ? (
              <div className="flex items-center w-full justify-between no-drag gap-1 px-1">
                <span className="text-[11px] text-amber-400 font-medium truncate">⚠ Settings Required</span>
                <button
                  onClick={() => window.api.openSettingsWindow()}
                  className="text-[10px] text-white hover:text-gray-200 underline underline-offset-2 cursor-pointer shrink-0"
                >
                  Open
                </button>
              </div>
            ) : (
              <div className="flex items-center w-full justify-between gap-1 px-1.5">
                 {MODES.map((mode) => (
                   <button
                     key={mode.value}
                     onClick={() => onModeChange(mode.value)}
                     className={`
                       no-drag px-3 py-1.5 rounded-[12px] text-xs font-semibold transition-all duration-150 cursor-pointer text-center flex-1
                       ${
                         activeMode === mode.value
                           ? 'bg-black/50 text-[#fdfdfd] shadow-md'
                           : 'text-[#d4d4d8] hover:text-[#fdfdfd] hover:bg-black/20'
                       }
                     `}
                   >
                     {mode.label}
                   </button>
                 ))}
              </div>
            )}
          </div>
        ) : status === 'done' ? (
          <span className="text-[10px] text-green-400 font-bold leading-none flex items-center justify-center h-full">✓</span>
        ) : null}
      </div>
    </div>
  )
}
