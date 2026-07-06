'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { AI_CAN_DECIDE_SUGGESTIONS } from '@/lib/ai-agent-constants'

interface SuggestedActionsInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
}

/**
 * Chip input for "Agent can decide" with a SUGGESTED ACTIONS dropdown
 * (Figma nodes 1057-28 · 1463-406). Pick a suggestion or type a custom
 * action and press Enter. Suggestions already added are filtered out.
 */
export function SuggestedActionsInput({
  value,
  onChange,
  placeholder = 'e.g. Resend tracking link…',
  disabled,
}: SuggestedActionsInputProps) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return AI_CAN_DECIDE_SUGGESTIONS.filter(
      (s) => !value.includes(s.label) && (q === '' || s.label.toLowerCase().includes(q)),
    )
  }, [draft, value])

  function commit(text: string) {
    const trimmed = text.trim().replace(/,+$/, '')
    if (!trimmed || value.includes(trimmed)) {
      setDraft('')
      return
    }
    onChange([...value, trimmed])
    setDraft('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="relative">
      <div className="flex min-h-[42px] flex-wrap items-center gap-2 rounded-[10px] border border-input bg-background px-3 py-2.5 transition-[color,box-shadow] focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
        {value.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary/8 py-1 pr-2 pl-2.5 text-sm font-semibold text-primary"
          >
            {chip}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== chip))}
                className="text-primary/60 transition-colors hover:text-primary"
                aria-label={`Remove ${chip}`}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            commit(draft)
            setOpen(false)
          }}
          placeholder={value.length === 0 ? placeholder : 'Add another…'}
          disabled={disabled}
          className="h-auto min-w-[140px] flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
        {value.length === 0 && (
          <span className="pointer-events-none inline-flex shrink-0 items-center rounded-md bg-primary/8 px-1.5 py-0.5 text-xs font-semibold text-primary">
            ↵ Enter
          </span>
        )}
      </div>

      {open && !disabled && (
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
      )}
    </div>
  )
}
