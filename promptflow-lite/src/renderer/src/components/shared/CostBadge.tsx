import { CostInfo } from '@shared/types'
import { formatTotalCost, formatTotalLatency } from '../../lib/utils'

interface CostBadgeProps {
  transcriptionCost: CostInfo
  rewriteCost: CostInfo
  transcriptionLatencyMs: number
  rewriteLatencyMs: number
}

export function CostBadge({
  transcriptionCost,
  rewriteCost,
  transcriptionLatencyMs,
  rewriteLatencyMs
}: CostBadgeProps) {
  const totalCost = formatTotalCost(transcriptionCost, rewriteCost)
  const totalLatency = formatTotalLatency(transcriptionLatencyMs, rewriteLatencyMs)

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-[10px] text-white/45 font-mono">
      <span>{totalCost}</span>
      <span className="text-white/20">·</span>
      <span>{totalLatency}</span>
    </span>
  )
}
