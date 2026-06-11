'use client'

import type { SourcePlatform } from '@/types/migrations'

interface PlatformOption {
  value: SourcePlatform
  label: string
  enabled: boolean
}

const PLATFORMS: PlatformOption[] = [
  { value: 'gorgias',    label: 'Gorgias',    enabled: true  },
  { value: 'zendesk',    label: 'Zendesk',    enabled: true  },
  { value: 'reamaze',    label: 'Re:amaze',   enabled: false },
  { value: 'commslayer', label: 'CommSlayer', enabled: false },
]

export function SelectPlatform({ onSelect }: { onSelect: (p: SourcePlatform) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Which platform are you migrating from?</h2>
        <p className="text-sm text-foreground-3">We&apos;ll import your conversations, tags, and macros.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            type="button"
            disabled={!p.enabled}
            onClick={() => p.enabled && onSelect(p.value)}
            className={[
              'flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card text-sm transition-colors',
              p.enabled
                ? 'cursor-pointer hover:border-primary hover:bg-primary/5'
                : 'cursor-not-allowed opacity-50',
            ].join(' ')}
          >
            <span className="text-base font-medium text-foreground">{p.label}</span>
            {!p.enabled && <span className="text-xs text-foreground-4">Coming soon</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
