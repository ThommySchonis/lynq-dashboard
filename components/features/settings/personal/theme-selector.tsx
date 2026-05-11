'use client'

import { Check } from 'lucide-react'
import { THEMES } from '@/lib/settings-constants'
import type { Theme } from '@/types/settings'

interface ThemeSelectorProps {
  value: Theme
  onChange: (theme: Theme) => void
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3">
      {THEMES.map((t) => {
        const Icon = t.Icon
        const selected = value === t.value

        return (
          <button
            key={t.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(t.value)}
            className={[
              'relative flex flex-col gap-1.5 rounded-xl border-2 p-3.5 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5',
            ].join(' ')}
          >
            {/* Checkmark badge */}
            {selected && (
              <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check size={12} strokeWidth={2.5} />
              </span>
            )}

            <span className={selected ? 'text-primary' : 'text-muted-foreground'}>
              <Icon size={20} strokeWidth={1.75} />
            </span>

            <span className="text-sm font-semibold text-foreground">{t.label}</span>
            <span className="text-xs text-muted-foreground leading-snug">{t.desc}</span>
          </button>
        )
      })}
    </div>
  )
}
