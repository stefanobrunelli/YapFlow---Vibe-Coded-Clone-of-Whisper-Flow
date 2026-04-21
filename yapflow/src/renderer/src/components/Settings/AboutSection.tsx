interface AboutSectionProps {
  version: string
}

const MODES = [
  {
    label: 'Raw',
    desc: 'Exact transcript, no changes. Free — skips the rewrite call.'
  },
  {
    label: 'Clean',
    desc: 'Removes filler words and fixes punctuation while preserving your voice.'
  },
  {
    label: 'AI Prompt',
    desc: 'Turns spoken rambling into a structured prompt with goal, context, and constraints.'
  }
]

const STEPS = [
  <>Get your preferred API keys (OpenAI or Groq)</>,
  <>Paste them in the respective tabs above</>,
  <>Hold <span className="font-mono text-white/75">⌘⌥Space</span>, speak, then release — text lands in your clipboard</>,
  <>Enable <span className="text-white/75 font-medium">Auto-Paste</span> in Settings to type directly into any app</>
]

export function AboutSection({ version }: AboutSectionProps) {
  return (
    <div className="flex flex-col gap-5">

      {/* Identity */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white/90">YapFlow</span>
          {version && (
            <span className="text-[10px] font-medium text-white/30 bg-white/8 border border-white/10 rounded px-1.5 py-0.5">
              v{version}
            </span>
          )}
        </div>
        <p className="text-[11px] text-white/50 leading-relaxed">
          A Wispr Flow-style dictation app for macOS, but better. Hold a keyboard shortcut, speak your mind, and your words
          land wherever your cursor is — transcribed, cleaned up, and ready to use.
        </p>
      </div>

      <div className="h-px bg-white/8" />

      {/* Setup */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-medium text-white/80">Getting started</span>
        <div className="flex flex-col gap-2">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="shrink-0 w-4 h-4 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mt-0.5">
                <span className="text-[9px] font-bold text-indigo-400">{i + 1}</span>
              </div>
              <p className="text-[11px] text-white/55 leading-relaxed">{step}</p>
            </div>
          ))}
          <div className="mt-1 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-white/60 leading-relaxed">
            <span className="text-indigo-300 font-medium">Dual API Setup:</span> We recommend adding both keys. <strong>Groq</strong> is completely free and lightning-fast, but has strict daily limits. <strong>OpenAI</strong> is your reliable, unlimited default fallback for when Groq limits are hit seamlessly in the background.
          </div>
        </div>
      </div>

      <div className="h-px bg-white/8" />

      {/* Modes */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-white/80">Rewrite modes</span>
        <div className="flex flex-col gap-1.5">
          {MODES.map((mode) => (
            <div key={mode.label} className="flex items-start gap-2 bg-white/5 border border-white/8 rounded-lg px-3 py-2">
              <span className="text-[11px] font-medium text-white/75 w-16 shrink-0">{mode.label}</span>
              <span className="text-[11px] text-white/45 leading-relaxed">{mode.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/8" />

      {/* Privacy */}
      <div className="flex items-start gap-2 bg-white/4 border border-white/8 rounded-lg px-3 py-2.5">
        <span className="text-[10px] text-white/30 leading-relaxed">
          <span className="text-white/50 font-medium">Privacy — </span>
          Audio is sent to OpenAI or Groq for transcription only. Nothing is stored on any external server. Your API keys are encrypted in the system keychain.
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-white/25">Made by Stefano Brunelli</span>
        <button
          className="text-[10px] text-white/30 hover:text-indigo-400 transition-colors cursor-pointer underline underline-offset-2"
          onClick={() => window.api.openExternal('https://github.com/stefanobrunelli/Whisper-App---Vibe-Coding-Project')}
        >
          GitHub
        </button>
      </div>

    </div>
  )
}
