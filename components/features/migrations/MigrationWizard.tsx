'use client'

import { useState } from 'react'
import { useCreateMigration } from '@/hooks/useMigrations'
import { SelectPlatform } from './steps/SelectPlatform'
import { Authenticate } from './steps/Authenticate'
import { LinkMailboxes } from './steps/LinkMailboxes'
import { ChooseTimeRange } from './steps/ChooseTimeRange'
import { Progress } from './steps/Progress'
import type { SourcePlatform, SourceMailbox } from '@/types/migrations'

interface Props {
  emailAccounts: Array<{ id: string; email: string }>
  onClose: () => void
}

type Step = 'platform' | 'auth' | 'mailboxes' | 'range' | 'progress'

export function MigrationWizard({ emailAccounts, onClose }: Props) {
  const [step, setStep] = useState<Step>('platform')
  const [platform, setPlatform] = useState<SourcePlatform | null>(null)
  const [migrationId, setMigrationId] = useState<string | null>(null)
  const [sourceMailboxes, setSourceMailboxes] = useState<SourceMailbox[]>([])
  const createMut = useCreateMigration()

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <Stepper step={step} />

      {step === 'platform' && (
        <SelectPlatform onSelect={(p) => {
          setPlatform(p)
          void createMut.mutateAsync({ source_platform: p }).then((r) => {
            setMigrationId(r.id)
            setStep('auth')
          })
        }} />
      )}

      {step === 'auth' && migrationId && platform && (
        <Authenticate
          migrationId={migrationId}
          platform={platform}
          onSuccess={(mailboxes) => { setSourceMailboxes(mailboxes); setStep('mailboxes') }}
        />
      )}

      {step === 'mailboxes' && migrationId && (
        <LinkMailboxes
          migrationId={migrationId}
          sourceMailboxes={sourceMailboxes}
          emailAccounts={emailAccounts}
          onSuccess={() => setStep('range')}
        />
      )}

      {step === 'range' && migrationId && (
        <ChooseTimeRange migrationId={migrationId} onSuccess={() => setStep('progress')} />
      )}

      {step === 'progress' && migrationId && (
        <Progress migrationId={migrationId} onClose={onClose} />
      )}
    </div>
  )
}

function Stepper({ step }: { step: Step }) {
  const labels: Array<[Step, string]> = [
    ['platform',  'Source'],
    ['auth',      'Connect'],
    ['mailboxes', 'Mailboxes'],
    ['range',     'Range'],
    ['progress',  'Import'],
  ]
  const currentIdx = labels.findIndex(([s]) => s === step)
  return (
    <div className="flex gap-2">
      {labels.map(([s, l], i) => (
        <div key={s} className={`flex-1 rounded-full px-2 py-1 text-center text-xs ${i <= currentIdx ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground-3'}`}>
          {l}
        </div>
      ))}
    </div>
  )
}
