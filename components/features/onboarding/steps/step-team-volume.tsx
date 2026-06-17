'use client'

import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'
import { PillGroup } from '../pill-group'
import { AGENT_COUNT_OPTIONS, TICKET_VOLUME_OPTIONS } from '@/lib/onboarding-constants'

interface StepTeamVolumeProps {
  stepIndex: number
  account: { name: string; email: string }
  agentCount: string | null
  ticketVolume: string | null
  onChange: (patch: { agentCount?: string; ticketVolume?: string }) => void
  onBack: () => void
  onNext: () => void
}

export function StepTeamVolume({
  stepIndex,
  account,
  agentCount,
  ticketVolume,
  onChange,
  onBack,
  onNext,
}: StepTeamVolumeProps) {
  return (
    <WizardShell
      account={account}
      footer={
        <ProgressFooter
          stepIndex={stepIndex}
          onBack={onBack}
          onNext={onNext}
          nextDisabled={!agentCount || !ticketVolume}
        />
      }
    >
      <div className="flex flex-col gap-8">
        <StepHeading title="Your team and volume" description="This helps us tailor your experience." />

        <PillGroup
          label="How many support agents?"
          options={AGENT_COUNT_OPTIONS}
          value={agentCount}
          onChange={(value) => onChange({ agentCount: value })}
        />

        <PillGroup
          label="Monthly ticket volume"
          options={TICKET_VOLUME_OPTIONS}
          value={ticketVolume}
          onChange={(value) => onChange({ ticketVolume: value })}
        />
      </div>
    </WizardShell>
  )
}
