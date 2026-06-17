'use client'

import { Mail, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'
import { IconBadge } from '../icon-badge'

interface StepConfirmProps {
  email: string
  onBack: () => void
  onNext: () => void
}

export function StepConfirm({ email, onBack, onNext }: StepConfirmProps) {
  return (
    <WizardShell footer={<ProgressFooter stepIndex={2} onBack={onBack} onNext={onNext} />}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
        <IconBadge icon={Mail} />

        <StepHeading
          center
          title="Check your inbox"
          description={
            <>
              We&apos;ve sent a confirmation link to{' '}
              <span className="font-medium text-foreground">{email || 'your email'}.</span> Click it to
              continue.
            </>
          }
        />

        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-foreground-3">
            Didn&apos;t receive the email? Check your spam folder before resending.
          </p>
          <Button variant="outline" size="lg">
            Resend email
          </Button>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 text-left text-sm text-foreground-2">
          <TriangleAlert className="size-4 shrink-0 text-warning" />
          You won&apos;t be able to log back in without confirming.
        </div>
      </div>
    </WizardShell>
  )
}
