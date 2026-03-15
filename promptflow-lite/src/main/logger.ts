/**
 * Logger — Structured cost and latency logging.
 *
 * Logs to the console in development and to a structured JSON log file
 * in production at: ~/Library/Logs/PromptFlowLite/app.log
 *
 * Each log entry is a JSON object on its own line (NDJSON format).
 */

import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs'
import { HistoryEntry } from '../shared/types'

interface LogEntry {
  timestamp: string
  type: string
  [key: string]: unknown
}

export class Logger {
  private logPath: string
  private isDev: boolean

  constructor() {
    this.isDev = !app.isPackaged
    const logsDir = join(app.getPath('logs'), 'PromptFlowLite')
    this.logPath = join(logsDir, 'app.log')

    if (!this.isDev) {
      mkdirSync(logsDir, { recursive: true })
    }
  }

  logTranscription(entry: Pick<HistoryEntry, 'transcriptionCost' | 'transcriptionLatencyMs' | 'audioDurationMs' | 'transcriptionModel'>): void {
    this.write({
      type: 'transcription',
      model: entry.transcriptionModel,
      audioDurationMs: entry.audioDurationMs,
      latencyMs: entry.transcriptionLatencyMs,
      cost: entry.transcriptionCost
    })
  }

  logRewrite(entry: Pick<HistoryEntry, 'rewriteCost' | 'rewriteLatencyMs' | 'rewriteMode'>): void {
    this.write({
      type: 'rewrite',
      mode: entry.rewriteMode,
      latencyMs: entry.rewriteLatencyMs,
      cost: entry.rewriteCost
    })
  }

  logError(context: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    this.write({ type: 'error', context, message })
  }

  logInfo(message: string, data?: Record<string, unknown>): void {
    this.write({ type: 'info', message, ...data })
  }

  private write(data: Omit<LogEntry, 'timestamp'>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      ...data
    }

    // Always log to console
    const { type, ...rest } = entry
    console.log(`[${type.toUpperCase()}]`, JSON.stringify(rest))

    // In production, also append to file
    if (!this.isDev) {
      try {
        appendFileSync(this.logPath, JSON.stringify(entry) + '\n', 'utf-8')
      } catch (err) {
        console.error('[Logger] Failed to write log file:', err)
      }
    }
  }
}
