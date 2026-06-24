'use client'

import { Input } from '@/components/ui/input'
import { BRAND_VOICES } from '@/lib/settings-constants'
import type { MacroWizardForm } from '@/lib/settings-constants'
import { WizardField, WizardOptionCard, WIZARD_INPUT_CLASS } from './wizard-fields'

interface WizardStepBrandProps {
  form: MacroWizardForm
  onChange: (field: string, value: string) => void
  errors: Record<string, string>
}

export function WizardStepBrand({ form, onChange, errors }: WizardStepBrandProps) {
  return (
    <div className="flex flex-col gap-6">
      <WizardField label="What’s your store called?" htmlFor="q-store-name" error={errors.store_name}>
        <Input
          id="q-store-name"
          type="text"
          placeholder="e.g. Elise Mimosa"
          value={form.store_name}
          onChange={(e) => onChange('store_name', e.target.value)}
          maxLength={200}
          autoFocus
          className={WIZARD_INPUT_CLASS}
        />
      </WizardField>

      <WizardField
        label="What kind of products do you sell?"
        htmlFor="q-what-sells"
        hint="Be specific — this shapes the macro tone."
        error={errors.what_sells}
      >
        <Input
          id="q-what-sells"
          type="text"
          placeholder="e.g. Women’s fashion, sustainable beauty, electronics"
          value={form.what_sells}
          onChange={(e) => onChange('what_sells', e.target.value)}
          maxLength={500}
          className={WIZARD_INPUT_CLASS}
        />
      </WizardField>

      <WizardField label="How does your brand speak?" error={errors.brand_voice}>
        <div className="flex flex-col gap-2.5">
          {BRAND_VOICES.map((v) => (
            <WizardOptionCard
              key={v.value}
              selected={form.brand_voice === v.value}
              title={v.value}
              desc={v.desc}
              onClick={() => onChange('brand_voice', v.value)}
            />
          ))}
        </div>
      </WizardField>
    </div>
  )
}
