'use client'

import { Button } from '@/components/ui/button'
import { TOTAL_STEPS } from '@/lib/onboarding-constants'

interface ProgressFooterProps {
  /** Zero-based index of the current step. */
  stepIndex: number
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  /** Hide the Next button entirely (e.g. when progression is external). */
  hideNext?: boolean
}

export function ProgressFooter({
  stepIndex,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  hideNext,
}: ProgressFooterProps) {
  const current = stepIndex + 1
  const progress = (current / TOTAL_STEPS) * 100

  return (
    <div className="flex items-center justify-between gap-6">
      {/* Progress: track + caption in one row (Figma footer_progress, 244px) */}
      <div className="flex w-[244px] items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="whitespace-nowrap text-xs text-foreground-4">
          Step {current} of {TOTAL_STEPS}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {onBack && (
          <Button
            variant="outline"
            onClick={onBack}
            className="h-11 rounded-lg px-6 text-sm font-semibold text-foreground-3"
          >
            Previous
          </Button>
        )}
        {!hideNext && (
          <Button
            onClick={onNext}
            disabled={nextDisabled}
            className="h-11 min-w-[185px] rounded-lg bg-foreground px-10 text-sm font-semibold text-background hover:bg-foreground/90 active:bg-foreground/90"
          >
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
