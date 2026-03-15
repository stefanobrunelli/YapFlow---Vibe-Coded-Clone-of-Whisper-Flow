
/**
 * OpenAIClient — SECURITY BOUNDARY.
 *
 * All OpenAI API calls are made here, in the main process.
 * The API key is retrieved from safeStorage and NEVER sent to the renderer.
 * The renderer sends audio/text via IPC → this module calls OpenAI → returns results.
 *
 * Rewrite modes:
 *   raw    — Skip GPT entirely; return transcript as-is (free!)
 *   clean  — Strip fillers, fix punctuation, preserve meaning
 *   prompt — Transform rambling speech into a structured AI prompt
 */

import OpenAI, { toFile } from 'openai'
import { SettingsStore } from './settingsStore'
import { Logger } from './logger'
import {
  TranscribeAudioPayload,
  TranscribeAudioResult,
  RewriteTextPayload,
  RewriteTextResult,
  CostInfo,
  RewriteMode
} from '../shared/types'
import { OPENAI, COST_RATES } from '../shared/constants'
import { DEFAULT_REWRITE_PROMPTS } from '../shared/rewritePrompts'

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

// ─── OpenAIClient ──────────────────────────────────────────────────────────────

export class OpenAIClient {
  private settingsStore: SettingsStore
  private logger: Logger

  constructor(settingsStore: SettingsStore, logger: Logger) {
    this.settingsStore = settingsStore
    this.logger = logger
  }

  private getClient(): OpenAI {
    const apiKey = this.settingsStore.getApiKey()
    if (!apiKey) {
      throw new Error('No API key configured. Please add your OpenAI API key in Settings.')
    }
    return new OpenAI({ apiKey })
  }

  // ─── Transcription ──────────────────────────────────────────────────────────

  async transcribeAudio(payload: TranscribeAudioPayload): Promise<TranscribeAudioResult> {
    const start = Date.now()
    const openai = this.getClient()
    const settings = this.settingsStore.getSettings()

    const buffer = Buffer.from(payload.audio)
    const audioExtension = extensionForMimeType(payload.mimeType)
    const audioFile = await toFile(buffer, `recording.${audioExtension}`, { type: payload.mimeType })

    this.logger.logInfo('Starting transcription request', {
      model: settings.transcriptionModel,
      audioDurationMs: payload.audioDurationMs,
      mimeType: payload.mimeType,
      bytes: buffer.byteLength
    })

    let response
    try {
      response = await openai.audio.transcriptions.create({
        model: settings.transcriptionModel,
        file: audioFile,
        response_format: 'json'
      })
    } catch (err) {
      this.logger.logError('transcribeAudio', err)
      throw err
    }

    const latencyMs = Date.now() - start
    const transcript = response.text.trim()

    // Cost estimation for audio transcription
    // gpt-4o-mini-transcribe: ~$0.003/min
    const audioDurationMin = payload.audioDurationMs / 60000
    const cost: CostInfo = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: audioDurationMin * COST_RATES.TRANSCRIPTION_PER_MIN_USD
    }

    this.logger.logTranscription({
      transcriptionModel: settings.transcriptionModel,
      audioDurationMs: payload.audioDurationMs,
      transcriptionLatencyMs: latencyMs,
      transcriptionCost: cost
    })

    return { transcript, cost, latencyMs }
  }

  // ─── Rewrite ────────────────────────────────────────────────────────────────

  async rewriteText(payload: RewriteTextPayload): Promise<RewriteTextResult> {
    // Raw mode: skip the GPT call entirely — return as-is for free
    if (payload.mode === 'raw') {
      return {
        result: payload.text,
        cost: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
        latencyMs: 0
      }
    }

    const start = Date.now()
    const openai = this.getClient()
    const settings = this.settingsStore.getSettings()
    const promptByMode: Record<Exclude<RewriteMode, 'raw'>, string> = {
      clean: settings.cleanRewriteInstructions.trim() || DEFAULT_REWRITE_PROMPTS.clean,
      prompt: settings.promptRewriteInstructions.trim() || DEFAULT_REWRITE_PROMPTS.prompt
    }
    const systemPrompt = promptByMode[payload.mode]

    let response
    try {
      response = await openai.chat.completions.create({
        model: OPENAI.REWRITE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: payload.text }
        ],
        max_tokens: OPENAI.MAX_TOKENS_REWRITE,
        temperature: OPENAI.TEMPERATURE_REWRITE
      })
    } catch (err) {
      this.logger.logError('rewriteText', err)
      throw err
    }

    const latencyMs = Date.now() - start
    const result = response.choices[0]?.message?.content?.trim() ?? payload.text

    const usage = response.usage
    const cost: CostInfo = {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
      estimatedCostUsd:
        (usage?.prompt_tokens ?? 0) * COST_RATES.GPT4O_MINI_INPUT_PER_TOKEN +
        (usage?.completion_tokens ?? 0) * COST_RATES.GPT4O_MINI_OUTPUT_PER_TOKEN
    }

    this.logger.logRewrite({
      rewriteMode: payload.mode,
      rewriteLatencyMs: latencyMs,
      rewriteCost: cost
    })

    return { result, cost, latencyMs }
  }

  /** Test whether the API key is valid by making a cheap models list call. */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const openai = this.getClient()
      await openai.models.list()
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  }
}
