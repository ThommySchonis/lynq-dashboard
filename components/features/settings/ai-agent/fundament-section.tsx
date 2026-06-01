'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsField } from '@/components/features/settings/settings-field'
import { StatusBadge } from '@/components/features/settings/status-badge'
import {
  TONE_OF_VOICE_OPTIONS,
  DEFAULT_TONE_OF_VOICE,
} from '@/lib/constants/emma-onboarding'
import type { ToneOfVoiceKey } from '@/lib/schemas/ai'

export interface FundamentValues {
  brand_name:        string
  brand_description: string
  tone_of_voice:     ToneOfVoiceKey
  sign_off:          string
  website_url:       string
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

const TONE_KEYS = TONE_OF_VOICE_OPTIONS.map((o) => o.key) as readonly ToneOfVoiceKey[]
const isToneKey = (v: string): v is ToneOfVoiceKey => (TONE_KEYS as readonly string[]).includes(v)

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
            hint="Pick the voice Emma should use in every reply."
          >
            <Select
              value={values.tone_of_voice}
              onValueChange={(v) => {
                if (v && isToneKey(v)) onChange({ tone_of_voice: v })
              }}
              disabled={!canEdit}
            >
              <SelectTrigger id="ai-tone" className="w-full">
                <SelectValue placeholder="Choose a tone" />
              </SelectTrigger>
              <SelectContent>
                {TONE_OF_VOICE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

/** Coerce a stored tone_of_voice value (possibly legacy free-text) to a
 *  valid TONE_OF_VOICE_KEYS member. Used by the onboarding shell when
 *  seeding the form from the loaded policies row.
 */
export function coerceToneOfVoice(stored: string | null | undefined): ToneOfVoiceKey {
  return stored && isToneKey(stored) ? stored : DEFAULT_TONE_OF_VOICE
}
