import { useState, useEffect } from 'react'
import { ApiKeyStatus } from '@shared/types'
import { Button } from '../shared/Button'

export function GroqKeySection() {
  const [hasKey, setHasKey] = useState(false)
  const [keyStatus, setKeyStatus] = useState<ApiKeyStatus>({ hasApiKey: false, maskedKey: null })
  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { refresh() }, [])

  const refresh = async () => {
    const [has, status] = await Promise.all([
      window.api.hasGroqApiKey(),
      window.api.getGroqApiKeyStatus()
    ])
    setHasKey(has)
    setKeyStatus(status)
  }

  const handleSave = async () => {
    const key = input.trim()
    if (!key || !key.startsWith('gsk_')) {
      setTestResult({ ok: false, error: 'Groq keys start with gsk_' })
      return
    }
    setSaving(true)
    try {
      await window.api.saveGroqApiKey(key)
      setInput('')
      await refresh()
      const result = await window.api.testGroqConnection()
      setTestResult(result.ok ? { ok: true } : result)
      setTimeout(() => setTestResult(null), 4000)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await window.api.testGroqConnection()
    setTestResult(result)
    setTesting(false)
  }

  const handleClear = async () => {
    setSaving(true)
    try {
      await window.api.clearGroqApiKey()
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/80">Groq API Key</span>
          {hasKey && (
            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
              Active — faster
            </span>
          )}
        </div>
        {hasKey && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Saved
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasKey ? '•••••••••••••••••••••' : 'gsk_...'}
            className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-1.5 text-xs text-white/80 placeholder:text-white/25 outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/20 transition-all font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
            aria-label={show ? 'Hide key' : 'Show key'}
          >
            {show ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
          </button>
        </div>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!input.trim() || saving}>
          {saving ? '…' : 'Save'}
        </Button>
        {hasKey && (
          <Button variant="ghost" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? '…' : 'Test'}
          </Button>
        )}
        {hasKey && (
          <Button variant="danger" size="sm" onClick={handleClear} disabled={saving}>
            {saving ? '…' : 'Remove'}
          </Button>
        )}
      </div>

      {testResult && (
        <p className={`text-[11px] ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {testResult.ok ? '✓ Groq connected — rewrite acceleration is available' : `✕ ${testResult.error}`}
        </p>
      )}

      {keyStatus.maskedKey && (
        <p className="text-[10px] text-white/45">
          Stored in Keychain as <span className="font-mono text-white/60">{keyStatus.maskedKey}</span>
        </p>
      )}

      <p className="text-[10px] text-white/30 leading-relaxed">
        Optional — uses Groq hardware for faster rewriting, and can act as the transcription fallback when no OpenAI key is saved.{' '}
        <button
          onClick={() => window.api.openExternal('https://console.groq.com/keys')}
          className="text-emerald-400/70 hover:text-emerald-400 underline cursor-pointer"
        >
          Get a free key
        </button>
      </p>
    </div>
  )
}
