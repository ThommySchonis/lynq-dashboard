'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MigrationWizard } from '@/components/features/migrations/MigrationWizard'
import { useEmailAccounts } from '@/hooks/settings/use-settings-data'

interface OnboardingMigrateStepProps {
  onAdvance: () => void
}

export function OnboardingMigrateStep({ onAdvance }: OnboardingMigrateStepProps) {
  const [showWizard, setShowWizard] = useState(false)
  const { data: emailAccounts } = useEmailAccounts()

  if (showWizard) {
    return (
      <MigrationWizard
        emailAccounts={(emailAccounts ?? []).map((ea) => ({ id: ea.id, email: ea.email }))}
        onClose={onAdvance}
      />
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-bold">Coming from another platform?</h2>
      <p className="text-sm text-foreground-3">
        Import your conversations, tags, and macros from Gorgias or Zendesk.
        You can also do this later in Settings.
      </p>
      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => setShowWizard(true)}
          className="bg-primary text-white rounded-[10px] px-6 py-[11px] text-sm font-semibold"
        >
          Import data
        </Button>
        <Button
          variant="ghost"
          onClick={onAdvance}
          className="text-white/50 text-sm px-6 py-[11px]"
        >
          Skip for now
        </Button>
      </div>
    </div>
  )
}
