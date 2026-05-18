'use client'

import type { WizardStep } from '@/lib/settings-constants'

interface WizardProgressProps {
  steps: WizardStep[]
  currentStep: number
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="mt-4 mb-7">
      {/* Step meta */}
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>Step {currentStep + 1} of {steps.length}</span>
        <span>{steps[currentStep].title}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-(--accent) rounded-full transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
