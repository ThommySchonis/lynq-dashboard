'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface ChipInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
}

/**
 * Controlled chip/tag input. Press Enter or comma to add a chip;
 * click × to remove. Manages its own draft state.
 */
export function ChipInput({ value, onChange, placeholder = 'Type and press Enter…', disabled }: ChipInputProps) {
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
    <div className="flex flex-wrap gap-1.5 p-2 border border-input rounded-lg bg-background min-h-[40px] focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-ring">
      {value.map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium"
        >
          {chip}
          {!disabled && (
            <button
              type="button"
              onClick={() => remove(chip)}
              className="text-primary/60 hover:text-primary transition-colors"
              aria-label={`Remove ${chip}`}
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={disabled}
        className="border-0 shadow-none focus-visible:ring-0 h-auto p-0 text-sm flex-1 min-w-[120px] bg-transparent"
      />
    </div>
  )
}
