'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
          <Card key={p.value} className={p.enabled ? 'cursor-pointer hover:border-border-hover' : 'opacity-50'}>
            <Button
              type="button"
              variant="ghost"
              disabled={!p.enabled}
              onClick={() => onSelect(p.value)}
              className="h-24 w-full flex-col gap-1"
            >
              <span className="text-base font-medium">{p.label}</span>
              {!p.enabled && <span className="text-xs text-foreground-4">Coming soon</span>}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
