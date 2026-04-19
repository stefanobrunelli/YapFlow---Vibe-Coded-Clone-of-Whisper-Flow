import { useState } from 'react'
import { HistoryEntry } from '@shared/types'
import { formatRelativeTime, formatTotalCost, formatTotalLatency, modeLabel, truncate } from '../../lib/utils'
import { Button } from '../shared/Button'

interface HistoryItemProps {
  entry: HistoryEntry
  onDelete: (id: string) => void
}

export function HistoryItem({ entry, onDelete }: HistoryItemProps) {
  const [copied, setCopied] = useState(false)
  const transcriptionProvider = entry.transcriptionProvider ?? 'openai'
  const rewriteProvider = entry.rewriteProvider ?? 'openai'

  const handleCopy = async () => {
    await window.api.copyToClipboard(entry.rewrittenText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = () => {
    onDelete(entry.id)
  }

  return (
    <div className="glass-card p-3 flex flex-col gap-2 group">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[9px] font-medium uppercase tracking-wider">
            {modeLabel(entry.rewriteMode)}
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-white/8 text-white/45 text-[9px] font-medium uppercase tracking-wider">
            Tx {transcriptionProvider}
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-white/8 text-white/45 text-[9px] font-medium uppercase tracking-wider">
            Rw {rewriteProvider}
          </span>
          <span className="text-[10px] text-white/30">
            {formatRelativeTime(entry.createdAt)}
          </span>
        </div>
        <span className="text-[9px] text-white/25 font-mono">
          {formatTotalCost(entry.transcriptionCost, entry.rewriteCost)}
          {' · '}
          {formatTotalLatency(entry.transcriptionLatencyMs, entry.rewriteLatencyMs)}
        </span>
      </div>

      {/* Text */}
      <p className="text-[12px] text-white/75 leading-relaxed line-clamp-3">
        {truncate(entry.rewrittenText, 180)}
      </p>

      {/* Actions (appear on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </Button>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  )
}
