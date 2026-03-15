/**
 * HistoryPanel — Slide-in history drawer.
 *
 * Shows recent transcription + rewrite results, newest first.
 * Rendered as an overlay within the app window.
 */

import { useState, useEffect, useCallback } from 'react'
import { Dialog } from '@headlessui/react'
import { HistoryEntry } from '@shared/types'
import { HistoryItem } from './HistoryItem'

interface HistoryPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function HistoryPanel({ isOpen, onClose }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Load history when panel opens
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    window.api.getHistory(50).then((data) => {
      setEntries(data)
      setLoading(false)
    })
  }, [isOpen])

  const handleDelete = useCallback(async (id: string) => {
    await window.api.deleteHistoryItem(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          className="no-drag w-full max-w-sm rounded-xl border border-white/15 shadow-2xl overflow-hidden animate-slide-in-right"
          style={{ background: 'var(--panel-bg)', backdropFilter: 'blur(24px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/8">
            <Dialog.Title className="text-sm font-semibold text-white/90">
              History
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
          <div className="p-3 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-white/35">No history yet</p>
                <p className="text-[11px] text-white/20 mt-1">Hold ⌘⌥Space to start recording</p>
              </div>
            ) : (
              entries.map((entry) => (
                <HistoryItem key={entry.id} entry={entry} onDelete={handleDelete} />
              ))
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
