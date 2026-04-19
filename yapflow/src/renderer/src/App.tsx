/**
 * App — Root React component.
 *
 * Detects which window it's running in:
 *   - HUD window (default): compact pill with recording pipeline
 *   - Settings window (?window=settings): full-page settings
 */

import { useCallback, useEffect } from 'react'
import { FloatingWindow } from './components/FloatingWindow/FloatingWindow'
import { SettingsPage } from './components/Settings/SettingsPage'
import { useAppState } from './hooks/useAppState'
import { useRecording } from './hooks/useRecording'
import { useIPCListener } from './hooks/useIPCListener'
import { useSettings } from './hooks/useSettings'
import { AppearanceMode, RewriteMode } from '../../shared/types'
import { useState } from 'react'

// ── Settings window ────────────────────────────────────────────────────────────

function SettingsApp() {
  const { settings, loading } = useSettings()
  const [systemAppearance, setSystemAppearance] = useState<Exclude<AppearanceMode, 'system'>>('dark')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncAppearance = (): void => {
      setSystemAppearance(mediaQuery.matches ? 'dark' : 'light')
    }
    syncAppearance()
    mediaQuery.addEventListener('change', syncAppearance)
    return () => mediaQuery.removeEventListener('change', syncAppearance)
  }, [])

  useEffect(() => {
    if (loading) return
    const resolvedAppearance =
      settings.appearanceMode === 'system' ? systemAppearance : settings.appearanceMode
    document.documentElement.dataset.theme = resolvedAppearance
    document.documentElement.style.colorScheme = resolvedAppearance
  }, [loading, settings.appearanceMode, systemAppearance])

  return (
    <div
      className="h-screen flex flex-col overflow-hidden select-none"
      style={{ background: 'var(--panel-bg)', backdropFilter: 'blur(24px)' }}
    >
      <SettingsPage />
    </div>
  )
}

// ── Main HUD ───────────────────────────────────────────────────────────────────

function HudApp() {
  const { state, actions } = useAppState()
  const { startRecording, stopRecording, discardRecording } = useRecording()
  const { settings, hasApiKey, loading } = useSettings()
  const [systemAppearance, setSystemAppearance] = useState<Exclude<AppearanceMode, 'system'>>('dark')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncAppearance = (): void => {
      setSystemAppearance(mediaQuery.matches ? 'dark' : 'light')
    }
    syncAppearance()
    mediaQuery.addEventListener('change', syncAppearance)
    return () => mediaQuery.removeEventListener('change', syncAppearance)
  }, [])

  useEffect(() => {
    if (loading) return
    const resolvedAppearance =
      settings.appearanceMode === 'system' ? systemAppearance : settings.appearanceMode
    document.documentElement.dataset.theme = resolvedAppearance
    document.documentElement.style.colorScheme = resolvedAppearance
  }, [loading, settings.appearanceMode, systemAppearance])

  // Check permissions on mount; open settings automatically only when no API key is set
  useEffect(() => {
    window.api.checkPermissions().then(actions.updatePermissions)
    if (!loading && !hasApiKey) {
      window.api.openSettingsWindow()
    }
  }, [loading, hasApiKey, actions.updatePermissions])

  // Auto-reset to idle after done/error so the HUD returns to neutral
  useEffect(() => {
    if (state.status !== 'done' && state.status !== 'error') return
    const delay = state.status === 'error' ? 15000 : 2500
    const timer = setTimeout(() => actions.reset(), delay)
    return () => clearTimeout(timer)
  }, [state.status, actions])

  // Watchdog only processing states. Long dictation sessions are valid and
  // should keep recording until the user explicitly stops them.
  useEffect(() => {
    const stuck = state.status === 'transcribing' || state.status === 'rewriting'
    if (!stuck) return
    const timer = setTimeout(() => actions.reset(), 60000)
    return () => clearTimeout(timer)
  }, [state.status, actions])

  // ── Shortcut down: begin recording ──────────────────────────────────────────
  const handleShortcutDown = useCallback(async () => {
    if (state.status === 'recording') return

    const started = await startRecording()
    if (started) {
      actions.recordingStarted()
    } else {
      actions.setError('Failed to access microphone. Please check permissions.')
    }
  }, [state.status, startRecording, actions])

  // ── Shortcut up: stop recording and run pipeline ────────────────────────────
  const handleShortcutUp = useCallback(async () => {
    if (state.status !== 'recording') return

    actions.recordingStopped()

    const recordingResult = await stopRecording()

    if (!recordingResult) {
      actions.reset()
      return
    }

    if (!hasApiKey) {
      actions.setError('No API key configured. Open Settings via the menu bar.')
      return
    }

    try {
      // Step 1: Transcribe
      const transcribeResult = await window.api.transcribeAudio(recordingResult)
      actions.transcriptionDone(transcribeResult.transcript, transcribeResult.cost, transcribeResult.latencyMs)

      // Step 2: Rewrite
      const rewriteResult = await window.api.rewriteText({
        text: transcribeResult.transcript,
        mode: state.activeMode
      })

      // Step 3: Save to history
      const historyEntry = await window.api.saveHistoryEntry({
        originalTranscript: transcribeResult.transcript,
        rewrittenText: rewriteResult.result,
        rewriteMode: state.activeMode,
        transcriptionModel: settings.transcriptionModel,
        transcriptionProvider: transcribeResult.provider,
        rewriteProvider: rewriteResult.provider,
        transcriptionLatencyMs: transcribeResult.latencyMs,
        rewriteLatencyMs: rewriteResult.latencyMs,
        transcriptionCost: transcribeResult.cost,
        rewriteCost: rewriteResult.cost,
        audioDurationMs: recordingResult.audioDurationMs
      })

      actions.rewriteDone(rewriteResult.result, rewriteResult.cost, rewriteResult.latencyMs, historyEntry)

      // Step 4: Copy + optionally paste
      if (state.permissions.accessibility) {
        const autoPasteResult = await window.api.autoPasteText(rewriteResult.result)
        if (!autoPasteResult.pasted) {
          await window.api.copyToClipboard(rewriteResult.result)
        }
      } else {
        await window.api.copyToClipboard(rewriteResult.result)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      actions.setError(message)
    }
  }, [
    state.status,
    state.activeMode,
    state.permissions.accessibility,
    settings.transcriptionModel,
    hasApiKey,
    stopRecording,
    actions
  ])

  const handleForceReset = useCallback(() => {
    discardRecording()
    actions.reset()
  }, [discardRecording, actions])

  useIPCListener({
    onShortcutDown: handleShortcutDown,
    onShortcutUp: handleShortcutUp,
    onPermissionChanged: actions.updatePermissions,
    onForceReset: handleForceReset
  })

  const handleModeChange = useCallback(
    (mode: RewriteMode) => {
      actions.setMode(mode)
    },
    [actions]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden select-none">
      <FloatingWindow
        state={state}
        activeMode={state.activeMode}
        onModeChange={handleModeChange}
        hasApiKey={hasApiKey}
      />
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function App() {
  const isSettingsWindow = new URLSearchParams(window.location.search).get('window') === 'settings'

  if (isSettingsWindow) {
    return <SettingsApp />
  }

  return <HudApp />
}
