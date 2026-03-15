/**
 * Renderer utility functions.
 */

import { CostInfo } from '../../../shared/types'

/** Format a USD cost as a human-readable string. */
export function formatCost(cost: CostInfo): string {
  if (cost.estimatedCostUsd === 0) return '$0.00'
  if (cost.estimatedCostUsd < 0.001) return `$${(cost.estimatedCostUsd * 1000).toFixed(3)}m`
  return `$${cost.estimatedCostUsd.toFixed(4)}`
}

/** Format total cost across transcription + rewrite. */
export function formatTotalCost(transcription: CostInfo, rewrite: CostInfo): string {
  const total = transcription.estimatedCostUsd + rewrite.estimatedCostUsd
  if (total === 0) return '$0.00'
  if (total < 0.001) return `<$0.001`
  return `$${total.toFixed(4)}`
}

/** Format a duration in milliseconds as a human-readable string. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** Format total latency across transcription + rewrite. */
export function formatTotalLatency(transcriptionMs: number, rewriteMs: number): string {
  return formatDuration(transcriptionMs + rewriteMs)
}

/** Format an ISO date string as a relative time label. */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Truncate text to a given character length, appending ellipsis. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}

/** Returns the display label for a rewrite mode. */
export function modeLabel(mode: string): string {
  switch (mode) {
    case 'raw': return 'Raw'
    case 'clean': return 'Clean'
    case 'prompt': return 'AI Prompt'
    default: return mode
  }
}
