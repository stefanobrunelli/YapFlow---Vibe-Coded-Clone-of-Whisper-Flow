/**
 * Logger — Structured cost and latency logging.
 *
 * Logs to the console in development and to a structured JSON log file
 * in production at: ~/Library/Logs/YapFlow/app.log
 *
 * Each log entry is a JSON object on its own line (NDJSON format).
 */

import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, mkdirSync } from 'fs'
import { ApiProvider, HistoryEntry } from '../shared/types'

interface LogEntry {
  timestamp: string
  type: string
  [key: string]: unknown
}

function sanitizeLogData(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {}

  const sanitized = { ...data }

  if ('type' in sanitized) {
    sanitized.detailType = sanitized.type
    delete sanitized.type
  }

  if ('timestamp' in sanitized) {
    sanitized.detailTimestamp = sanitized.timestamp
    delete sanitized.timestamp
  }

  return sanitized
}

export class Logger {
  private logPath: string
  private isDev: boolean

  constructor() {
    this.isDev = !app.isPackaged
    const logsDir = join(app.getPath('logs'), 'YapFlow')
    this.logPath = join(logsDir, 'app.log')

    if (!this.isDev) {
      mkdirSync(logsDir, { recursive: true })
    }
  }

  logTranscription(entry: Pick<HistoryEntry, 'transcriptionCost' | 'transcriptionLatencyMs' | 'audioDurationMs' | 'transcriptionModel' | 'transcriptionProvider'>): void {
    this.write({
      type: 'transcription',
      provider: entry.transcriptionProvider,
      model: entry.transcriptionModel,
      audioDurationMs: entry.audioDurationMs,
      latencyMs: entry.transcriptionLatencyMs,
      cost: entry.transcriptionCost
    })
  }

  logRewrite(entry: Pick<HistoryEntry, 'rewriteCost' | 'rewriteLatencyMs' | 'rewriteMode' | 'rewriteProvider'>): void {
    this.write({
      type: 'rewrite',
      provider: entry.rewriteProvider,
      mode: entry.rewriteMode,
      latencyMs: entry.rewriteLatencyMs,
      cost: entry.rewriteCost
    })
  }

  logProviderFallback(from: ApiProvider, to: ApiProvider, operation: 'transcription' | 'rewrite', reason: string): void {
    this.write({
      type: 'provider_fallback',
      operation,
      from,
      to,
      reason
    })
  }

  logError(context: string, error: unknown): void {
    if (error instanceof Error) {
      this.write({
        type: 'error',
        context,
        name: error.name,
        message: error.message,
        stack: error.stack
      })
      return
    }

    this.write({ type: 'error', context, message: String(error) })
  }

  logInfo(message: string, data?: Record<string, unknown>): void {
    this.write({ ...sanitizeLogData(data), type: 'info', message })
  }

  /**
   * Forward a raw log line from the uiohook utilityProcess child into the
   * same log stream. Each chunk from child stderr may contain multiple
   * newline-separated lines; split and log each.
   */
  logHook(prefix: string, text: string): void {
    for (const line of text.split('\n')) {
      const trimmed = line.trimEnd()
      if (trimmed) this.write({ type: 'hook', prefix, line: trimmed })
    }
  }

  private write(data: Omit<LogEntry, 'timestamp'>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    } as LogEntry

    // Always log to console
    const { type, ...rest } = entry
    const consoleType = typeof type === 'string' ? type : 'unknown'
    let serialized: string
    try {
      serialized = JSON.stringify(rest)
    } catch {
      serialized = '[unserializable]'
    }
    console.log(`[${consoleType.toUpperCase()}]`, serialized)

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
