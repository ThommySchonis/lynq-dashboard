'use client'

import { Textarea } from '@/components/ui/textarea'
import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'
import { ChoiceChip } from '../choice-chip'
import { REFERRAL_OPTIONS } from '@/lib/onboarding-constants'

interface StepHearAboutProps {
  stepIndex: number
  account: { name: string; email: string }
  referral: string | null
  referralDetails: string
  onChange: (patch: { referral?: string; referralDetails?: string }) => void
  onBack: () => void
  onNext: () => void
}

export function StepHearAbout({
  stepIndex,
  account,
  referral,
  referralDetails,
  onChange,
  onBack,
  onNext,
}: StepHearAboutProps) {
  return (
    <WizardShell
      account={account}
      footer={<ProgressFooter stepIndex={stepIndex} onBack={onBack} onNext={onNext} nextDisabled={!referral} />}
    >
      <div className="flex flex-col gap-8">
        <StepHeading
          title="How did you find out about us?"
          description="This assists us in comprehending how to connect with more individuals like you."
        />

        <div className="flex flex-wrap gap-3">
          {REFERRAL_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.value}
              icon={option.icon}
              label={option.label}
              selected={referral === option.value}
              onSelect={() => onChange({ referral: option.value })}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="referral-details" className="text-sm font-medium text-foreground-2">
            Share additional details (optional)
          </label>
          <Textarea
            id="referral-details"
            value={referralDetails}
            onChange={(e) => onChange({ referralDetails: e.target.value })}
            placeholder="Provide further information"
            rows={4}
          />
        </div>
      </div>
    </WizardShell>
  )
}
