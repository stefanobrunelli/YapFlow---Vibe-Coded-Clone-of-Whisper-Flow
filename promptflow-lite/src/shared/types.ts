// PromptFlow Lite — Shared TypeScript types
// Used by both main process and renderer via the IPC bridge.

// ─── Enums / Unions ──────────────────────────────────────────────────────────

/** The three rewrite modes available in the app. */
export type RewriteMode = 'raw' | 'clean' | 'prompt'

/** Transcription models supported by OpenAI. */
export type TranscriptionModel = 'gpt-4o-mini-transcribe' | 'whisper-1'

/** The overall status of the app's recording/processing pipeline. */
export type AppStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'rewriting'
  | 'done'
  | 'error'

// ─── Settings ─────────────────────────────────────────────────────────────────

/** Persisted user settings (stored via electron-store). */
export interface AppSettings {
  transcriptionModel: TranscriptionModel
  rewriteMode: RewriteMode
  autoPasteEnabled: boolean
  /** Hide from Dock; show only as menu bar app. */
  showInDock: boolean
  launchAtLogin: boolean
  /** Window background opacity: 0.85–1.0 */
  windowOpacity: number
  hasCompletedOnboarding: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  transcriptionModel: 'gpt-4o-mini-transcribe',
  rewriteMode: 'clean',
  autoPasteEnabled: false,
  showInDock: false,
  launchAtLogin: false,
  windowOpacity: 0.95,
  hasCompletedOnboarding: false
}

// ─── Cost & History ───────────────────────────────────────────────────────────

/** Token usage and estimated USD cost for one OpenAI call. */
export interface CostInfo {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  /** Computed client-side from known $/token rates. */
  estimatedCostUsd: number
}

/** A single entry in the local history store. */
export interface HistoryEntry {
  id: string
  createdAt: string // ISO 8601
  originalTranscript: string
  rewrittenText: string
  rewriteMode: RewriteMode
  transcriptionModel: TranscriptionModel
  transcriptionLatencyMs: number
  rewriteLatencyMs: number
  transcriptionCost: CostInfo
  rewriteCost: CostInfo
  audioDurationMs: number
}

// ─── IPC Payloads ─────────────────────────────────────────────────────────────

/** Sent from renderer to main when audio recording completes. */
export interface TranscribeAudioPayload {
  /** Raw bytes of the WebM/Opus audio blob. */
  audio: ArrayBuffer
  mimeType: string // e.g. 'audio/webm;codecs=opus'
  audioDurationMs: number
}

/** Returned from main to renderer after transcription completes. */
export interface TranscribeAudioResult {
  transcript: string
  cost: CostInfo
  latencyMs: number
}

/** Sent from renderer to main to rewrite a transcript. */
export interface RewriteTextPayload {
  text: string
  mode: RewriteMode
}

/** Returned from main to renderer after rewrite completes. */
export interface RewriteTextResult {
  result: string
  cost: CostInfo
  latencyMs: number
}

/** Sent from renderer to main when saving settings. */
export interface SaveSettingsPayload {
  settings: AppSettings
  /** Only present when the API key is being changed. */
  apiKey?: string
}

// ─── Permission Status ────────────────────────────────────────────────────────

/** Current macOS permission state for features the app needs. */
export interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'not-determined'
  /** True if the app is a trusted Accessibility client (for auto-paste). */
  accessibility: boolean
}

// ─── App State (renderer-side only) ──────────────────────────────────────────

/** Full UI state managed by the renderer's useReducer. */
export interface AppState {
  status: AppStatus
  currentTranscript: string | null
  currentResult: string | null
  lastError: string | null
  activeMode: RewriteMode
  permissions: PermissionStatus
  latestEntry: HistoryEntry | null
}
