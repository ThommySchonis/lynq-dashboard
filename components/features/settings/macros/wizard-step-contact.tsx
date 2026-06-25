'use client'

import { Input } from '@/components/ui/input'
import type { MacroWizardForm } from '@/lib/settings-constants'
import { WizardField, WIZARD_INPUT_CLASS } from './wizard-fields'

interface WizardStepContactProps {
  form: MacroWizardForm
  onChange: (field: string, value: string) => void
  errors: Record<string, string>
}

export function WizardStepContact({ form, onChange, errors }: WizardStepContactProps) {
  return (
    <div className="flex flex-col gap-6">
      <WizardField label="What’s your support email?" htmlFor="q-support-email" error={errors.support_email}>
        <Input
          id="q-support-email"
          type="email"
          placeholder="e.g. hello@yourstore.com"
          value={form.support_email}
          onChange={(e) => onChange('support_email', e.target.value)}
          maxLength={200}
          autoFocus
          className={WIZARD_INPUT_CLASS}
        />
      </WizardField>

      <WizardField label="How do you sign your emails?" htmlFor="q-signature" error={errors.signature}>
        <Input
          id="q-signature"
          type="text"
          placeholder="e.g. With warmth, Elise Mimosa"
          value={form.signature}
          onChange={(e) => onChange('signature', e.target.value)}
          maxLength={300}
          className={WIZARD_INPUT_CLASS}
        />
      </WizardField>

      <WizardField
        label="Where can customers track orders?"
        htmlFor="q-tracking"
        hint="Leave blank if you don’t have one."
      >
        <Input
          id="q-tracking"
          type="text"
          placeholder="e.g. https://yourstore.com/apps/parcelpanel"
          value={form.tracking_link}
          onChange={(e) => onChange('tracking_link', e.target.value)}
          maxLength={500}
          className={WIZARD_INPUT_CLASS}
        />
      </WizardField>
    </div>
  )
}
