'use client'

import type { WizardStep } from '@/lib/settings-constants'

interface WizardProgressProps {
  steps: WizardStep[]
  currentStep: number
}

/** Segmented step progress (Figma node 820-16): "STEP X OF N" + one bar per step. */
export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          Step {currentStep + 1} of {steps.length}
        </span>
        <span className="text-xs text-muted-foreground">{steps[currentStep].title}</span>
      </div>
      <div className="flex gap-1.5">
        {steps.map((step, i) => (
          <span
            key={step.title}
            className={`h-1 flex-1 rounded-full ${i <= currentStep ? 'bg-primary' : 'bg-foreground/[0.08]'}`}
          />
        ))}
      </div>
    </div>
  )
}
