'use client'

import { Textarea } from '@/components/ui/textarea'
import type { MacroWizardForm } from '@/lib/settings-constants'
import { WizardField } from './wizard-fields'

interface WizardStepFinalProps {
  form: MacroWizardForm
  onChange: (field: string, value: string) => void
}

export function WizardStepFinal({ form, onChange }: WizardStepFinalProps) {
  return (
    <div className="flex flex-col gap-6">
      <WizardField
        label="Other policies, store quirks, or things AI should know"
        htmlFor="q-extra"
        hint="The more context you add, the better your macros."
      >
        <Textarea
          id="q-extra"
          placeholder="e.g. Size exchanges cost £15 / We process orders in 1–3 days / We offer partial refunds 10–50% as alternatives to returns"
          value={form.extra_notes}
          onChange={(e) => onChange('extra_notes', e.target.value)}
          maxLength={2000}
          rows={6}
          autoFocus
          className="min-h-[230px] resize-y rounded-xl bg-card px-4 py-3.5 text-sm leading-relaxed"
        />
      </WizardField>
    </div>
  )
}
