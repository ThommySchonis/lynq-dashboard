'use client'

import { Mail, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'
import { IconBadge } from '../icon-badge'

interface StepConfirmProps {
  stepIndex: number
  email: string
  onBack: () => void
  onNext: () => void
}

export function StepConfirm({ stepIndex, email, onBack, onNext }: StepConfirmProps) {
  return (
    <WizardShell footer={<ProgressFooter stepIndex={stepIndex} onBack={onBack} onNext={onNext} />}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
        <IconBadge icon={Mail} />

        <StepHeading
          center
          title="Check your inbox"
          description={
            <>
              We&apos;ve sent a confirmation link to{' '}
              <span className="underline">{email || 'your email'}.</span> Click it to continue.
            </>
          }
        />

        <div className="flex flex-col items-center gap-3">
          <div className="text-center">
            <p className="text-sm text-foreground">Didn&apos;t receive the email?</p>
            <p className="text-sm text-foreground-3">Check your spam folder before resending.</p>
          </div>
          <Button variant="outline" size="lg">
            Resend email
          </Button>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg bg-warning-soft px-4 py-2.5 text-left text-xs text-foreground-2">
          <TriangleAlert className="size-5 shrink-0 text-warning" />
          You won&apos;t be able to log back in without confirming
        </div>
      </div>
    </WizardShell>
  )
}
