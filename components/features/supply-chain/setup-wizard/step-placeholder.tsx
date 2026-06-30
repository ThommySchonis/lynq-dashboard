'use client'

import { StepHeader } from './wizard-ui'

/**
 * Interim body for wizard steps whose pixel-perfect content lands in a later
 * phase. Keeps the stepper navigable without claiming functionality that the
 * backend does not yet support.
 */
export function StepPlaceholder({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <StepHeader step={step} title={title} subtitle={subtitle} />
      <div className="flex w-full items-center justify-center rounded-2xl border border-dashed border-border px-6 py-12">
        <p className="text-sm font-medium text-foreground-4">Configuration options arrive in an upcoming update.</p>
      </div>
    </div>
  )
}
