// PromptFlow Lite — Shared constants
// Single source of truth for IPC channel names, shortcut keys, and model IDs.
// Importing from both main process and renderer keeps typos impossible.

// ─── IPC Channel Names ────────────────────────────────────────────────────────

/**
 * All IPC channels used in the app.
 *
 * Renderer → Main: use ipcRenderer.invoke(IPC.CHANNEL_NAME, payload)
 * Main → Renderer: use webContents.send(IPC.CHANNEL_NAME, payload)
 */
export const IPC = {
  // ── Renderer invokes (request → response) ──
  TRANSCRIBE_AUDIO: 'transcribe-audio',
  REWRITE_TEXT: 'rewrite-text',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  GET_HISTORY: 'get-history',
  DELETE_HISTORY_ITEM: 'delete-history-item',
  CLEAR_HISTORY: 'clear-history',
  CHECK_PERMISSIONS: 'check-permissions',
  REQUEST_ACCESSIBILITY: 'request-accessibility',
  AUTO_PASTE_TEXT: 'auto-paste-text',
  COPY_TO_CLIPBOARD: 'copy-to-clipboard',
  OPEN_EXTERNAL: 'open-external',
  GET_APP_VERSION: 'get-app-version',
  HAS_API_KEY: 'has-api-key',

  // ── Shortcut recording ──
  START_SHORTCUT_CAPTURE: 'start-shortcut-capture',
  STOP_SHORTCUT_CAPTURE: 'stop-shortcut-capture',
  SAVE_SHORTCUT: 'save-shortcut',

  // ── Window management ──
  OPEN_SETTINGS_WINDOW: 'open-settings-window',
  RESIZE_HUD: 'resize-hud',

  // ── Main sends (fire-and-forget events) ──
  SHORTCUT_KEYDOWN: 'shortcut-keydown',
  SHORTCUT_KEYUP: 'shortcut-keyup',
  SHORTCUT_CAPTURED: 'shortcut-captured',
  PERMISSION_CHANGED: 'permission-changed',
  PROCESSING_STATE: 'processing-state'
} as const

// ─── uiohook-napi Key Codes ───────────────────────────────────────────────────

/**
 * Key codes from uiohook-napi for macOS.
 * These are the raw HID codes, not character codes.
 */
export const KEY_CODES = {
  CTRL_LEFT: 29,
  CTRL_RIGHT: 3613,
  META_LEFT: 3675, // Cmd (left)
  META_RIGHT: 3676, // Cmd (right)
  ALT_LEFT: 3640, // Option (left)
  ALT_RIGHT: 3641, // Option (right)
  SPACE: 57
} as const

// ─── OpenAI Config ────────────────────────────────────────────────────────────

export const OPENAI = {
  TRANSCRIPTION_MODEL_PRIMARY: 'gpt-4o-mini-transcribe',
  TRANSCRIPTION_MODEL_FALLBACK: 'whisper-1',
  REWRITE_MODEL: 'gpt-4o-mini',
  MAX_TOKENS_REWRITE: 1024,
  TEMPERATURE_REWRITE: 0.3,
  /** Minimum audio duration (ms) before sending to API. Prevents noise. */
  MIN_AUDIO_DURATION_MS: 300
} as const

// ─── Cost Rates (USD per token, approximate as of early 2026) ─────────────────

export const COST_RATES = {
  // gpt-4o-mini-transcribe: ~$0.003/min, approximated per token
  TRANSCRIPTION_PER_MIN_USD: 0.003,
  // gpt-4o-mini: $0.15 input / $0.60 output per 1M tokens
  GPT4O_MINI_INPUT_PER_TOKEN: 0.00000015,
  GPT4O_MINI_OUTPUT_PER_TOKEN: 0.0000006
} as const

// ─── History Config ───────────────────────────────────────────────────────────

export const HISTORY = {
  MAX_ENTRIES: 500
} as const
