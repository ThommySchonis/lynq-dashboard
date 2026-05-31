'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsField } from '@/components/features/settings/settings-field'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { ChipInput } from '@/components/shared/chip-input'

export interface FundamentValues {
  brand_name: string
  brand_description: string
  tone_of_voice: string
  sign_off: string
  languages: string[]
  website_url: string
}

interface FundamentSectionProps {
  values: FundamentValues
  canEdit: boolean
  isSaving: boolean
  isDirty: boolean
  isComplete: boolean
  onChange: (patch: Partial<FundamentValues>) => void
  onSave: () => void
}

export function FundamentSection({
  values,
  canEdit,
  isSaving,
  isDirty,
  isComplete,
  onChange,
  onSave,
}: FundamentSectionProps) {
  return (
    <SettingsSection
      title="Fundament"
      description="The brand identity the AI agent uses in every reply for this store."
      actions={
        <StatusBadge
          status={isComplete ? 'active' : 'pending'}
          label={isComplete ? 'Complete' : 'Incomplete'}
        />
      }
    >
      <SettingsCard
        footer={
          canEdit ? (
            <Button onClick={onSave} disabled={!isDirty || isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-5">
          <SettingsField label="Brand name" htmlFor="ai-brand-name">
            <Input
              id="ai-brand-name"
              type="text"
              value={values.brand_name}
              onChange={(e) => onChange({ brand_name: e.target.value })}
              placeholder="e.g. Acme Co."
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField
            label="Brand description"
            htmlFor="ai-brand-description"
            hint="What you sell and what makes the brand distinctive."
          >
            <Textarea
              id="ai-brand-description"
              value={values.brand_description}
              onChange={(e) => onChange({ brand_description: e.target.value })}
              placeholder="A short description of the brand and product range…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField
            label="Tone of voice"
            htmlFor="ai-tone"
            hint="e.g. Warm & personal, Professional & efficient."
          >
            <Input
              id="ai-tone"
              type="text"
              value={values.tone_of_voice}
              onChange={(e) => onChange({ tone_of_voice: e.target.value })}
              placeholder="How replies should sound"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField
            label="Sign-off"
            htmlFor="ai-sign-off"
            hint="The closing line of every reply, e.g. “Kind regards, the Acme team”."
          >
            <Input
              id="ai-sign-off"
              type="text"
              value={values.sign_off}
              onChange={(e) => onChange({ sign_off: e.target.value })}
              placeholder="Kind regards, the team"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField
            label="Languages"
            hint="Languages the agent may reply in. Type and press Enter."
          >
            <ChipInput
              value={values.languages}
              onChange={(languages) => onChange({ languages })}
              placeholder="e.g. English, Nederlands…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField label="Website URL" htmlFor="ai-website">
            <Input
              id="ai-website"
              type="text"
              value={values.website_url}
              onChange={(e) => onChange({ website_url: e.target.value })}
              placeholder="https://example.com"
              disabled={!canEdit}
            />
          </SettingsField>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
