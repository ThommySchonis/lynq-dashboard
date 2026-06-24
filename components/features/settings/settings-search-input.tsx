'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

/** Full-width settings search field (Figma: white bg, magnifier left). */
export function SettingsSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search
        size={15}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="bg-card pl-9"
      />
    </div>
  )
}
