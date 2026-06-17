'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LOCALE_OPTIONS } from '@/lib/onboarding-constants'

/**
 * Language picker in the wizard header.
 * Uses the app's standard Select with the same workspace locales as settings.
 * UI-first: selection is local state — wiring real locale switching is deferred.
 */
export function LanguageSelector() {
  const [locale, setLocale] = useState('en')

  return (
    <Select value={locale} onValueChange={(v) => v && setLocale(v)}>
      <SelectTrigger className="h-9 bg-card">
        <SelectValue>
          {(value: string | null) => {
            const opt = LOCALE_OPTIONS.find((o) => o.value === value) ?? LOCALE_OPTIONS[0]
            return (
              <>
                <span aria-hidden className="text-base leading-none">{opt.flag}</span>
                <span className="font-medium">{opt.label} ({opt.short})</span>
              </>
            )
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LOCALE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span aria-hidden className="text-base leading-none">{opt.flag}</span>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
