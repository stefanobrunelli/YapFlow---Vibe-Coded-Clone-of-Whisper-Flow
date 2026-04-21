/**
 * useAppState — Central state management for the renderer.
 *
 * Uses useReducer to manage the complete pipeline state:
 *   idle → recording → transcribing → rewriting → done
 *
 * All state transitions are explicit and traceable.
 */

import { useReducer, useCallback } from 'react'
import { AppState, CostInfo, RewriteMode, HistoryEntry, PermissionStatus } from '../../../shared/types'

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'RECORDING_STARTED' }
  | { type: 'RECORDING_STOPPED' }
  | { type: 'TRANSCRIPTION_DONE'; transcript: string; cost: CostInfo; latency: number }
  | { type: 'REWRITE_DONE'; result: string; cost: CostInfo; latency: number; entry: HistoryEntry }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' }
  | { type: 'SET_MODE'; mode: RewriteMode }
  | { type: 'PERMISSIONS_UPDATED'; permissions: PermissionStatus }

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: AppState = {
  status: 'idle',
  currentTranscript: null,
  currentResult: null,
  lastError: null,
  activeMode: 'clean',
  permissions: {
    microphone: 'not-determined',
    accessibility: false
  },
  latestEntry: null
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'RECORDING_STARTED':
      return { ...state, status: 'recording', currentTranscript: null, currentResult: null, lastError: null }

    case 'RECORDING_STOPPED':
      return { ...state, status: 'transcribing' }

    case 'TRANSCRIPTION_DONE':
      return { ...state, status: 'rewriting', currentTranscript: action.transcript }

    case 'REWRITE_DONE':
      return {
        ...state,
        status: 'done',
        currentResult: action.result,
        latestEntry: action.entry
      }

    case 'ERROR':
      return { ...state, status: 'error', lastError: action.message }

    case 'RESET':
      return { ...state, status: 'idle', lastError: null }

    case 'SET_MODE':
      return { ...state, activeMode: action.mode }

    case 'PERMISSIONS_UPDATED':
      return { ...state, permissions: action.permissions }

    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const actions = {
    recordingStarted: useCallback(() => dispatch({ type: 'RECORDING_STARTED' }), []),
    recordingStopped: useCallback(() => dispatch({ type: 'RECORDING_STOPPED' }), []),

    transcriptionDone: useCallback(
      (transcript: string, cost: CostInfo, latency: number) =>
        dispatch({ type: 'TRANSCRIPTION_DONE', transcript, cost, latency }),
      []
    ),

    rewriteDone: useCallback(
      (result: string, cost: CostInfo, latency: number, entry: HistoryEntry) =>
        dispatch({ type: 'REWRITE_DONE', result, cost, latency, entry }),
      []
    ),

    setError: useCallback(
      (message: string) => dispatch({ type: 'ERROR', message }),
      []
    ),

    reset: useCallback(() => dispatch({ type: 'RESET' }), []),

    setMode: useCallback(
      (mode: RewriteMode) => dispatch({ type: 'SET_MODE', mode }),
      []
    ),

    updatePermissions: useCallback(
      (permissions: PermissionStatus) => dispatch({ type: 'PERMISSIONS_UPDATED', permissions }),
      []
    )
  }

  return { state, actions }
}
