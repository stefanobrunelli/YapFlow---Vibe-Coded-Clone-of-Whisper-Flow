/**
 * ResultCard — Shows the transcript and rewritten output after processing.
 *
 * Slides up with an animation when status transitions to 'done' or 'error'.
 * Displays the rewritten text prominently with copy and action buttons.
 */

import { useState, useCallback } from 'react'
import { AppState } from '@shared/types'
import { CostBadge } from '../shared/CostBadge'
import { Button } from '../shared/Button'
import { truncate } from '../../lib/utils'

interface ResultCardProps {
  state: AppState
  onReset: () => void
}

export function ResultCard({ state, onReset }: ResultCardProps) {
  const [copied, setCopied] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  const { status, currentResult, currentTranscript, lastError, latestEntry } = state

  const visible = status === 'done' || status === 'error'
  if (!visible) return null

  const handleCopy = useCallback(async () => {
    if (!currentResult) return
    await window.api.copyToClipboard(currentResult)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [currentResult])

  const handlePaste = useCallback(async () => {
    if (!currentResult) return
    await window.api.autoPasteText(currentResult)
  }, [currentResult])

  if (status === 'error') {
    return (
      <div className="animate-fade-in-up glass-card p-3 mx-3 mb-3">
        <p className="text-xs text-red-400 leading-relaxed">{lastError}</p>
        <Button variant="ghost" size="sm" onClick={onReset} className="mt-2">
          Dismiss
        </Button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up flex flex-col gap-2 px-3 pb-3 flex-1 min-h-0">
      {/* Main result */}
      <div className="glass-card p-3 flex-1 min-h-0 flex flex-col gap-2">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <p className="text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap break-words">
            {currentResult}
          </p>
        </div>

        {/* Transcript toggle */}
        {currentTranscript && currentTranscript !== currentResult && (
          <div>
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="text-[10px] text-white/30 hover:text-white/50 transition-colors no-drag cursor-pointer"
            >
              {showTranscript ? '▲ Hide' : '▼ Original transcript'}
            </button>
            {showTranscript && (
              <p className="mt-1.5 text-[11px] text-white/40 leading-relaxed border-t border-white/10 pt-1.5">
                {truncate(currentTranscript, 200)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between no-drag">
        <div className="flex items-center gap-1">
          <Button variant="primary" size="sm" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePaste} title="Paste into active app">
            Paste
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset} title="Dismiss">
            ✕
          </Button>
        </div>

        {latestEntry && (
          <CostBadge
            transcriptionCost={latestEntry.transcriptionCost}
            rewriteCost={latestEntry.rewriteCost}
            transcriptionLatencyMs={latestEntry.transcriptionLatencyMs}
            rewriteLatencyMs={latestEntry.rewriteLatencyMs}
          />
        )}
      </div>
    </div>
  )
}
