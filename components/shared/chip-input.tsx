'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface ChipInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  /** Show a "↵ Enter" affix while the field is empty (Figma onboarding inputs). */
  enterHint?: boolean
}

/**
 * Controlled chip/tag input. Press Enter or comma to add a chip;
 * click × to remove. Manages its own draft state.
 */
export function ChipInput({
  value,
  onChange,
  placeholder = 'Type and press Enter…',
  disabled,
  enterHint,
}: ChipInputProps) {
  const [draft, setDraft] = useState('')

  function commit(text: string) {
    const trimmed = text.trim().replace(/,+$/, '')
    if (!trimmed || value.includes(trimmed)) return
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
  }

  function remove(chip: string) {
    onChange(value.filter((v) => v !== chip))
  }

  return (
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
              onClick={() => remove(chip)}
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
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : 'Add another…'}
        disabled={disabled}
        className="h-auto min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
      />
      {enterHint && value.length === 0 && (
        <span className="pointer-events-none inline-flex shrink-0 items-center rounded-md bg-primary/8 px-1.5 py-0.5 text-xs font-semibold text-primary">
          ↵ Enter
        </span>
      )}
    </div>
  )
}
