import { AppState, RewriteMode } from '@shared/types'
import { RecordingOrb } from './RecordingOrb'
import { useState, useEffect } from 'react'

const MODES: { value: RewriteMode; label: string }[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'clean', label: 'Clean' },
  { value: 'prompt', label: 'Prompt' }
]

interface FloatingWindowProps {
  state: AppState
  activeMode: RewriteMode
  onModeChange: (mode: RewriteMode) => void
}

export function FloatingWindow({ state, activeMode, onModeChange }: FloatingWindowProps) {
  const { status } = state
  const [isHovered, setIsHovered] = useState(false)

  const isRecording = status === 'recording' || status === 'transcribing' || status === 'rewriting'
  const isExpanded = isHovered || isRecording

  useEffect(() => {
    // Determine the target dimensions based on state
    let targetWidth = 60
    let targetHeight = 30

    if (isRecording) {
      targetWidth = 60
      targetHeight = 30
    } else if (isHovered) {
      targetWidth = 180
      targetHeight = 34
    }

    // Add a slight delay before shrinking back to avoid "finicky" flickering 
    // when moving mouse between the pill and the edge.
    const timeout = setTimeout(() => {
      window.api.resizeHud(targetWidth, targetHeight)
    }, isHovered ? 0 : 100)

    return () => clearTimeout(timeout)
  }, [isExpanded, isRecording])

  return (
    <div 
      className="drag-region flex items-center justify-center w-full h-full overflow-hidden transition-all duration-300 ease-in-out px-1 rounded-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isExpanded ? (
        <div className="flex items-center gap-2 w-full justify-between animate-in fade-in zoom-in-95 duration-200">
          {isRecording ? (
             <div className="flex items-center justify-center w-full h-full">
               <RecordingOrb status={status} compact />
             </div>
          ) : (
            <div className="flex items-center w-full justify-between no-drag gap-0.5">
               {MODES.map((mode) => (
                 <button
                   key={mode.value}
                   onClick={() => onModeChange(mode.value)}
                   className={`
                     px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer text-center flex-1
                     ${
                       activeMode === mode.value
                         ? 'bg-white/20 text-white shadow-sm'
                         : 'text-white/50 hover:text-white/90 hover:bg-white/10'
                     }
                   `}
                 >
                   {mode.label}
                 </button>
               ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center w-full h-full animate-in fade-in duration-300">
          {/* Default tiny state: just the compact orb. */}
          <RecordingOrb status={status} compact />
        </div>
      )}
    </div>
  )
}
