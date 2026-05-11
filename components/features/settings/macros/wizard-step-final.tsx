'use client'

import { Textarea } from '@/components/ui/textarea'
import type { MacroWizardForm } from '@/lib/settings-constants'

interface WizardStepFinalProps {
  form: MacroWizardForm
  onChange: (field: string, value: string) => void
  errors: Record<string, string>
}

export function WizardStepFinal({ form, onChange, errors }: WizardStepFinalProps) {
  return (
    <div className="mb-4.5">
      <label htmlFor="q-extra" className="block text-[13px] font-medium text-foreground mb-1.5">
        Other policies, store quirks, or things AI should know
      </label>
      <Textarea
        id="q-extra"
        placeholder="e.g. Size exchanges cost £15 / We process orders in 1-3 days / We offer partial refunds 10-50% as alternatives to returns"
        value={form.extra_notes}
        onChange={(e) => onChange('extra_notes', e.target.value)}
        maxLength={2000}
        rows={6}
        autoFocus
        className="resize-y min-h-[100px] leading-relaxed"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">The more context, the better your macros</p>
    </div>
  )
}
