'use client'

import { ChipInput } from '@/components/shared/chip-input'
import { AI_CAN_DECIDE_SUGGESTIONS } from '@/lib/ai-agent-constants'

interface SuggestedActionsInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
}

/**
 * "Agent can decide" field: a {@link ChipInput} with a SUGGESTED ACTIONS
 * dropdown layered on top (Figma nodes 1057-28 · 1463-406). Pick a suggestion
 * or type a custom action and press Enter. Already-added suggestions are hidden.
 */
export function SuggestedActionsInput({
  value,
  onChange,
  placeholder = 'e.g. Resend tracking link…',
  disabled,
}: SuggestedActionsInputProps) {
  return (
    <ChipInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      enterHint
      renderDropdown={({ draft, open, commit }) => {
        if (!open) return null
        const q = draft.trim().toLowerCase()
        const suggestions = AI_CAN_DECIDE_SUGGESTIONS.filter(
          (s) => !value.includes(s.label) && (q === '' || s.label.toLowerCase().includes(q)),
        )
        return (
          // preventDefault keeps the input focused so item clicks register before blur.
          <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-x-0 top-full z-50 mt-1.5 flex flex-col gap-px rounded-xl border border-settings-border bg-popover p-1.5 shadow-[0px_12px_32px_-6px_rgba(20,17,43,0.18)]"
          >
            <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
              SUGGESTED ACTIONS
            </p>
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => commit(s.label)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
              >
                <span className="truncate">{s.label}</span>
                {s.category && (
                  <span className="shrink-0 text-xs text-muted-foreground">{s.category}</span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => commit(draft)}
              disabled={!draft.trim()}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
            >
              <span className="truncate">
                {draft.trim() ? `Add “${draft.trim()}”` : 'Add a custom action'}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">↵ Enter</span>
            </button>
          </div>
        )
      }}
    />
  )
}
