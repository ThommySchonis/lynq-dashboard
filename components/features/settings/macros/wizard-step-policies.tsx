'use client'

import { Input } from '@/components/ui/input'
import { RETURN_SHIPPING, DAMAGE_POLICY } from '@/lib/settings-constants'
import type { MacroWizardForm } from '@/lib/settings-constants'

interface WizardStepPoliciesProps {
  form: MacroWizardForm
  onChange: (field: string, value: string | number) => void
  errors: Record<string, string>
}

function OptionCard({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`flex items-start gap-2.5 p-3 px-3.5 rounded-[10px] border-2 text-left transition-colors cursor-pointer ${
        selected
          ? 'border-(--accent) bg-(--accent)/5'
          : 'border-border hover:border-border/80'
      }`}
      onClick={onClick}
    >
      <span
        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
          selected ? 'border-(--accent)' : 'border-muted-foreground/40'
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-(--accent)" />}
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  )
}

export function WizardStepPolicies({ form, onChange, errors }: WizardStepPoliciesProps) {
  return (
    <>
      {/* Return window */}
      <div className="mb-4.5">
        <label htmlFor="q-return-days" className="block text-[13px] font-medium text-foreground mb-1.5">
          How many days do customers have to return?
        </label>
        <div className="flex items-center gap-2.5">
          <Input
            id="q-return-days"
            type="number"
            min={1}
            max={365}
            value={form.return_days}
            onChange={(e) =>
              onChange('return_days', e.target.value === '' ? '' as unknown as number : Number(e.target.value))
            }
            autoFocus
            className={`max-w-[120px] ${errors.return_days ? 'border-destructive focus:ring-destructive/20' : ''}`}
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
        {errors.return_days && (
          <p className="mt-1 text-xs text-destructive">{errors.return_days}</p>
        )}
      </div>

      {/* Return shipping */}
      <div className="mb-4.5">
        <label className="block text-[13px] font-medium text-foreground mb-1.5">
          Who pays return shipping?
        </label>
        <div className="flex flex-col gap-2">
          {RETURN_SHIPPING.map((v) => (
            <OptionCard
              key={v}
              label={v}
              selected={form.return_shipping === v}
              onClick={() => onChange('return_shipping', v)}
            />
          ))}
        </div>
        {errors.return_shipping && (
          <p className="mt-1 text-xs text-destructive">{errors.return_shipping}</p>
        )}
      </div>

      {/* Damage policy */}
      <div className="mb-4.5">
        <label className="block text-[13px] font-medium text-foreground mb-1.5">
          What if an item arrives damaged?
        </label>
        <div className="flex flex-col gap-2">
          {DAMAGE_POLICY.map((v) => (
            <OptionCard
              key={v}
              label={v}
              selected={form.damage_policy === v}
              onClick={() => onChange('damage_policy', v)}
            />
          ))}
        </div>
        {errors.damage_policy && (
          <p className="mt-1 text-xs text-destructive">{errors.damage_policy}</p>
        )}
      </div>
    </>
  )
}
