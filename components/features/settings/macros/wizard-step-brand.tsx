'use client'

import { Input } from '@/components/ui/input'
import { BRAND_VOICES } from '@/lib/settings-constants'
import type { MacroWizardForm } from '@/lib/settings-constants'

interface WizardStepBrandProps {
  form: MacroWizardForm
  onChange: (field: string, value: string) => void
  errors: Record<string, string>
}

export function WizardStepBrand({ form, onChange, errors }: WizardStepBrandProps) {
  return (
    <>
      {/* Store name */}
      <div className="mb-4.5">
        <label htmlFor="q-store-name" className="block text-[13px] font-medium text-foreground mb-1.5">
          What&rsquo;s your store called?
        </label>
        <Input
          id="q-store-name"
          type="text"
          placeholder="e.g. Elise Mimosa"
          value={form.store_name}
          onChange={(e) => onChange('store_name', e.target.value)}
          maxLength={200}
          autoFocus
          className={errors.store_name ? 'border-destructive focus:ring-destructive/20' : ''}
        />
        {errors.store_name && (
          <p className="mt-1 text-xs text-destructive">{errors.store_name}</p>
        )}
      </div>

      {/* What sells */}
      <div className="mb-4.5">
        <label htmlFor="q-what-sells" className="block text-[13px] font-medium text-foreground mb-1.5">
          What kind of products do you sell?
        </label>
        <Input
          id="q-what-sells"
          type="text"
          placeholder="e.g. Women's fashion, sustainable beauty, electronics"
          value={form.what_sells}
          onChange={(e) => onChange('what_sells', e.target.value)}
          maxLength={500}
          className={errors.what_sells ? 'border-destructive focus:ring-destructive/20' : ''}
        />
        {errors.what_sells ? (
          <p className="mt-1 text-xs text-destructive">{errors.what_sells}</p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">Be specific — this shapes the macro tone</p>
        )}
      </div>

      {/* Brand voice */}
      <div className="mb-4.5">
        <label className="block text-[13px] font-medium text-foreground mb-1.5">
          How does your brand speak?
        </label>
        <div className="flex flex-col gap-2">
          {BRAND_VOICES.map((v) => (
            <button
              key={v.value}
              type="button"
              className={`flex items-start gap-2.5 p-3 px-3.5 rounded-[10px] border-2 text-left transition-colors cursor-pointer ${
                form.brand_voice === v.value
                  ? 'border-(--accent) bg-(--accent)/5'
                  : 'border-border hover:border-border/80'
              }`}
              onClick={() => onChange('brand_voice', v.value)}
            >
              <span
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  form.brand_voice === v.value ? 'border-(--accent)' : 'border-muted-foreground/40'
                }`}
              >
                {form.brand_voice === v.value && (
                  <span className="w-2 h-2 rounded-full bg-(--accent)" />
                )}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{v.value}</span>
                <span className="text-xs text-muted-foreground">{v.desc}</span>
              </span>
            </button>
          ))}
        </div>
        {errors.brand_voice && (
          <p className="mt-1 text-xs text-destructive">{errors.brand_voice}</p>
        )}
      </div>
    </>
  )
}
