import { DEFAULT_REWRITE_PROMPTS } from '@shared/rewritePrompts'
import { AppSettings, RewriteMode } from '@shared/types'
import { Button } from '../shared/Button'

const MODES: { value: RewriteMode; label: string; desc: string }[] = [
  {
    value: 'raw',
    label: 'Raw Transcript',
    desc: 'Exact transcription, no changes. Free — skips the rewrite call.'
  },
  {
    value: 'clean',
    label: 'Clean Text',
    desc: 'Removes filler words and fixes punctuation while preserving your voice.'
  },
  {
    value: 'prompt',
    label: 'AI Prompt',
    desc: 'Transforms spoken rambling into a structured prompt with clear goal and constraints.'
  }
]

interface RewriteModeSectionProps {
  settings: AppSettings
  activeMode: RewriteMode
  onChange: (partial: Partial<AppSettings>) => void
  onApply?: () => Promise<void> | void
}

export function RewriteModeSection({ settings, activeMode, onChange, onApply }: RewriteModeSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-white/80">Default Rewrite Mode</span>
      <p className="text-[10px] text-white/40 leading-relaxed">
        These fields are fully editable. The text you put here becomes the system instructions for the selected rewrite modes.
      </p>
      <div className="flex flex-col gap-1.5">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => onChange({ rewriteMode: mode.value })}
            className={`
              flex items-start gap-2.5 p-2.5 rounded-lg border transition-all duration-150 text-left cursor-pointer
              ${
                activeMode === mode.value
                  ? 'bg-indigo-500/15 border-indigo-400/40'
                  : 'bg-white/5 border-white/8 hover:bg-white/8'
              }
            `}
          >
            <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              activeMode === mode.value ? 'border-indigo-400' : 'border-white/30'
            }`}>
              {activeMode === mode.value && (
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              )}
            </div>
            <div>
              <div className="text-xs font-medium text-white/85">{mode.label}</div>
              <div className="text-[10px] text-white/40 mt-0.5 leading-relaxed">{mode.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <div>
          <div className="text-xs font-medium text-white/80">Clean Text Instructions</div>
          <div className="text-[10px] text-white/40 mt-0.5">
            Controls how spoken text is cleaned up before being pasted. Editable and saved from this panel.
          </div>
        </div>
        <textarea
          value={settings.cleanRewriteInstructions}
          onChange={(e) => onChange({ cleanRewriteInstructions: e.target.value })}
          rows={8}
          className="w-full resize-y rounded-lg border border-white/12 bg-white/6 px-3 py-2 text-[11px] leading-relaxed text-white/80 outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/20"
        />
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ cleanRewriteInstructions: DEFAULT_REWRITE_PROMPTS.clean })}
          >
            Reset Clean
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <div>
          <div className="text-xs font-medium text-white/80">AI Prompt Instructions</div>
          <div className="text-[10px] text-white/40 mt-0.5">
            Long-form rules for how the spoken note should be turned into a structured AI prompt. Editable and saved from this panel.
          </div>
        </div>
        <textarea
          value={settings.promptRewriteInstructions}
          onChange={(e) => onChange({ promptRewriteInstructions: e.target.value })}
          rows={10}
          className="w-full resize-y rounded-lg border border-white/12 bg-white/6 px-3 py-2 text-[11px] leading-relaxed text-white/80 outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/20"
        />
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ promptRewriteInstructions: DEFAULT_REWRITE_PROMPTS.prompt })}
          >
            Reset Prompt
          </Button>
        </div>
      </div>

      {onApply && (
        <div className="flex justify-end pt-1">
          <Button variant="primary" size="sm" onClick={() => void onApply()}>
            Save Prompt Rules
          </Button>
        </div>
      )}
    </div>
  )
}
