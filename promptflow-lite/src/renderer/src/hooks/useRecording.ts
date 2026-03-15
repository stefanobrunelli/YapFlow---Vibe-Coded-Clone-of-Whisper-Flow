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
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4'
  ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function useRecording() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

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

      // Use WebM/Opus as it's well-supported and compressed
      const mimeType = getPreferredMimeType()

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorderRef.current = recorder
      recorder.start()
      return true
    } catch (err) {
      console.error('[useRecording] Failed to start recording:', err)
      return false
    }
  }, [])

  const stopRecording = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      const startTime = startTimeRef.current

      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }

      const audioDurationMs = Date.now() - startTime

      recorder.onstop = async () => {
        const chunks = chunksRef.current
        if (chunks.length === 0) {
          stopStream()
          recorderRef.current = null
          resolve(null)
          return
        }

        const mimeType = recorder.mimeType || chunks[0]?.type || 'audio/webm'
        const blob = new Blob(chunks, { type: mimeType })

        if (
          audioDurationMs < OPENAI.MIN_AUDIO_DURATION_MS ||
          blob.size < MIN_AUDIO_SIZE_BYTES
        ) {
          stopStream()
          recorderRef.current = null
          chunksRef.current = []
          resolve(null)
          return
        }

        const audio = await blob.arrayBuffer()

        stopStream()
        recorderRef.current = null
        chunksRef.current = []

        resolve({ audio, mimeType, audioDurationMs })
      }

      recorder.requestData()
      recorder.stop()
    })
  }, [])

  const stopStream = (): void => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const isRecording = (): boolean => {
    return recorderRef.current?.state === 'recording'
  }

  return { startRecording, stopRecording, isRecording }
}
