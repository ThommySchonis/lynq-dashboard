'use client'

import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TOTAL_STEPS } from '@/lib/onboarding-constants'

interface ProgressFooterProps {
  /** Zero-based index of the current step. */
  stepIndex: number
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
}

export function ProgressFooter({
  stepIndex,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
}: ProgressFooterProps) {
  const current = stepIndex + 1
  const progress = (current / TOTAL_STEPS) * 100

  return (
    <div className="flex items-center justify-between gap-6 border-t border-border pt-6">
      <div className="flex-1">
        <div className="h-1 w-full max-w-56 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-foreground-3">
          Step {current} of {TOTAL_STEPS}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="outline" size="lg" onClick={onBack}>
            Previous
          </Button>
        )}
        <Button size="lg" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
