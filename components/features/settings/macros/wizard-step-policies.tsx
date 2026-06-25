'use client'

import { Input } from '@/components/ui/input'
import { RETURN_SHIPPING, DAMAGE_POLICY } from '@/lib/settings-constants'
import type { MacroWizardForm } from '@/lib/settings-constants'
import { WizardField, WizardOptionCard, WIZARD_INPUT_CLASS } from './wizard-fields'

interface WizardStepPoliciesProps {
  form: MacroWizardForm
  onChange: (field: string, value: string | number) => void
  errors: Record<string, string>
}

export function WizardStepPolicies({ form, onChange, errors }: WizardStepPoliciesProps) {
  return (
    <div className="flex flex-col gap-6">
      <WizardField
        label="How many days do customers have to return?"
        htmlFor="q-return-days"
        error={errors.return_days}
      >
        <div className="flex items-center gap-2.5">
          <Input
            id="q-return-days"
            type="number"
            min={1}
            max={365}
            value={form.return_days}
            onChange={(e) =>
              onChange('return_days', e.target.value === '' ? ('' as unknown as number) : Number(e.target.value))
            }
            autoFocus
            className={`w-[120px] ${WIZARD_INPUT_CLASS}`}
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      </WizardField>

      <WizardField label="Who pays return shipping?" error={errors.return_shipping}>
        <div className="flex flex-col gap-2.5">
          {RETURN_SHIPPING.map((v) => (
            <WizardOptionCard
              key={v}
              selected={form.return_shipping === v}
              title={v}
              onClick={() => onChange('return_shipping', v)}
            />
          ))}
        </div>
      </WizardField>

      <WizardField label="What if an item arrives damaged?" error={errors.damage_policy}>
        <div className="flex flex-col gap-2.5">
          {DAMAGE_POLICY.map((v) => (
            <WizardOptionCard
              key={v}
              selected={form.damage_policy === v}
              title={v}
              onClick={() => onChange('damage_policy', v)}
            />
          ))}
        </div>
      </WizardField>
    </div>
  )
}
