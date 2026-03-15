import { useState } from 'react'
import { ApiKeyStatus } from '@shared/types'
import { Button } from '../shared/Button'

interface ApiKeySectionProps {
  hasApiKey: boolean
  apiKeyStatus: ApiKeyStatus
  onSave: (key: string) => Promise<void>
}

export function ApiKeySection({ hasApiKey, apiKeyStatus, onSave }: ApiKeySectionProps) {
  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const key = input.trim()
    if (!key || !key.startsWith('sk-')) {
      setTestResult({ ok: false, error: 'Key must start with sk-' })
      return
    }
    setSaving(true)
    try {
      await onSave(key)
      setInput('')
      const result = await window.api.testApiConnection()
      setTestResult(result.ok ? { ok: true } : result)
      setTimeout(() => setTestResult(null), 4000)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await window.api.testApiConnection()
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/80">OpenAI API Key</span>
        {hasApiKey && (
          <span className="text-[10px] text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
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
            placeholder={hasApiKey ? '•••••••••••••••••••••' : 'sk-...'}
            className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-1.5 text-xs text-white/80 placeholder:text-white/25 outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/20 transition-all font-mono"
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
        {hasApiKey && (
          <Button variant="ghost" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? '…' : 'Test'}
          </Button>
        )}
      </div>

      {testResult && (
        <p className={`text-[11px] ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
          {testResult.ok ? '✓ Key saved and API connection works' : `✕ ${testResult.error}`}
        </p>
      )}

      {apiKeyStatus.maskedKey && (
        <p className="text-[10px] text-white/45">
          Stored in Keychain as <span className="font-mono text-white/60">{apiKeyStatus.maskedKey}</span>
        </p>
      )}

      <p className="text-[10px] text-white/30 leading-relaxed">
        Your key is encrypted with OS Keychain — never stored in plaintext.{' '}
        <button
          onClick={() => window.api.openExternal('https://platform.openai.com/api-keys')}
          className="text-indigo-400/70 hover:text-indigo-400 underline cursor-pointer"
        >
          Get a key
        </button>
      </p>
    </div>
  )
}
