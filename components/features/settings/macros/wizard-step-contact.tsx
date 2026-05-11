'use client'

import { Input } from '@/components/ui/input'
import type { MacroWizardForm } from '@/lib/settings-constants'

interface WizardStepContactProps {
  form: MacroWizardForm
  onChange: (field: string, value: string) => void
  errors: Record<string, string>
}

export function WizardStepContact({ form, onChange, errors }: WizardStepContactProps) {
  return (
    <>
      {/* Support email */}
      <div className="mb-4.5">
        <label htmlFor="q-support-email" className="block text-[13px] font-medium text-foreground mb-1.5">
          What&rsquo;s your support email?
        </label>
        <Input
          id="q-support-email"
          type="email"
          placeholder="e.g. hello@yourstore.com"
          value={form.support_email}
          onChange={(e) => onChange('support_email', e.target.value)}
          maxLength={200}
          autoFocus
          className={errors.support_email ? 'border-destructive focus:ring-destructive/20' : ''}
        />
        {errors.support_email && (
          <p className="mt-1 text-xs text-destructive">{errors.support_email}</p>
        )}
      </div>

      {/* Signature */}
      <div className="mb-4.5">
        <label htmlFor="q-signature" className="block text-[13px] font-medium text-foreground mb-1.5">
          How do you sign your emails?
        </label>
        <Input
          id="q-signature"
          type="text"
          placeholder="e.g. With warmth, Elise Mimosa"
          value={form.signature}
          onChange={(e) => onChange('signature', e.target.value)}
          maxLength={300}
          className={errors.signature ? 'border-destructive focus:ring-destructive/20' : ''}
        />
        {errors.signature && (
          <p className="mt-1 text-xs text-destructive">{errors.signature}</p>
        )}
      </div>

      {/* Tracking link */}
      <div className="mb-4.5">
        <label htmlFor="q-tracking" className="block text-[13px] font-medium text-foreground mb-1.5">
          Where can customers track orders?
        </label>
        <Input
          id="q-tracking"
          type="text"
          placeholder="e.g. https://yourstore.com/apps/parcelpanel"
          value={form.tracking_link}
          onChange={(e) => onChange('tracking_link', e.target.value)}
          maxLength={500}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Leave blank if you don&rsquo;t have one</p>
      </div>
    </>
  )
}
