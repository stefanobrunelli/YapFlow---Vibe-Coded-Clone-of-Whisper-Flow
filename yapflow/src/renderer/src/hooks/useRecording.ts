/**
 * useRecording — MediaRecorder lifecycle management.
 *
 * Captures microphone audio using Web Audio APIs (browser-native).
 * The audio blob is sent to the main process as an ArrayBuffer via IPC.
 *
 * Minimum recording duration (300ms) prevents accidental triggers.
 */

import { useRef, useCallback } from 'react'
import { OPENAI } from '@shared/constants'

interface RecordingResult {
  audio: ArrayBuffer
  mimeType: string
  audioDurationMs: number
}

const MIN_AUDIO_SIZE_BYTES = 1024

function getPreferredMimeType(): string {
  const candidates = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm'
  ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function useRecording() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  const stopStream = useCallback((): void => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const discardRecording = useCallback((): void => {
    const recorder = recorderRef.current

    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.stop()
    }

    recorderRef.current = null
    chunksRef.current = []
    startTimeRef.current = 0
    stopStream()
  }, [stopStream])

  const finalizeRecording = useCallback(async (mimeTypeHint?: string): Promise<RecordingResult | null> => {
    const startTime = startTimeRef.current
    const chunks = chunksRef.current

    recorderRef.current = null

    if (chunks.length === 0 || startTime === 0) {
      chunksRef.current = []
      startTimeRef.current = 0
      stopStream()
      return null
    }

    const audioDurationMs = Date.now() - startTime
    const mimeType = mimeTypeHint || chunks[0]?.type || 'audio/webm'
    const blob = new Blob(chunks, { type: mimeType })

    chunksRef.current = []
    startTimeRef.current = 0
    stopStream()

    if (
      audioDurationMs < OPENAI.MIN_AUDIO_DURATION_MS ||
      blob.size < MIN_AUDIO_SIZE_BYTES
    ) {
      return null
    }

    const audio = await blob.arrayBuffer()
    return { audio, mimeType, audioDurationMs }
  }, [stopStream])

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      // Request microphone access — macOS will show permission dialog if needed
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000 // 16kHz is ideal for speech recognition
        },
        video: false
      })

      streamRef.current = stream
      chunksRef.current = []
      startTimeRef.current = Date.now()

      // Prefer MP4 on desktop when available; some STT providers are less reliable
      // with short WebM blobs produced by MediaRecorder.
      const mimeType = getPreferredMimeType()

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onerror = (event) => {
        console.error('[useRecording] MediaRecorder error:', event)
      }

      recorderRef.current = recorder
      recorder.start(1000)
      return true
    } catch (err) {
      discardRecording()
      console.error('[useRecording] Failed to start recording:', err)
      return false
    }
  }, [discardRecording])

  const stopRecording = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current

      if (!recorder) {
        resolve(null)
        return
      }

      if (recorder.state === 'inactive') {
        void finalizeRecording(recorder.mimeType).then(resolve)
        return
      }

      recorder.onstop = () => {
        void finalizeRecording(recorder.mimeType).then(resolve)
      }

      recorder.requestData()
      recorder.stop()
    })
  }, [finalizeRecording])

  const isRecording = (): boolean => {
    return recorderRef.current?.state === 'recording'
  }

  return { startRecording, stopRecording, discardRecording, isRecording }
}
