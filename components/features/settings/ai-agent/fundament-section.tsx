'use client'

import { useEffect, useState } from 'react'
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
import { ChipInput } from '@/components/shared/chip-input'
import { useAiPolicies, useUpsertAiPolicies } from '@/hooks/ai'
import type { AiPoliciesRow } from '@/hooks/ai'

interface FundamentForm {
  brand_name: string
  brand_description: string
  industry: string
  product_categories: string[]
  formality_level: '' | 'casual' | 'balanced' | 'formal'
  communication_style: string[]
  personality_preferences: string
  tone_of_voice: string
  sign_off: string
  languages: string[]
  website_url: string
}

const EMPTY: FundamentForm = {
  brand_name: '',
  brand_description: '',
  industry: '',
  product_categories: [],
  formality_level: '',
  communication_style: [],
  personality_preferences: '',
  tone_of_voice: '',
  sign_off: '',
  languages: [],
  website_url: '',
}

function rowToForm(row: AiPoliciesRow | null | undefined): FundamentForm {
  return {
    brand_name:              row?.brand_name              ?? '',
    brand_description:       row?.brand_description       ?? '',
    industry:                row?.industry                ?? '',
    product_categories:      row?.product_categories      ?? [],
    formality_level:         row?.formality_level         ?? '',
    communication_style:     row?.communication_style     ?? [],
    personality_preferences: row?.personality_preferences ?? '',
    tone_of_voice:           row?.tone_of_voice           ?? '',
    sign_off:                row?.sign_off                ?? '',
    languages:               row?.languages               ?? [],
    website_url:             row?.website_url             ?? '',
  }
}

const sameList = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)

interface FundamentSectionProps {
  storeId: string
  canEdit: boolean
}

export function FundamentSection({ storeId, canEdit }: FundamentSectionProps) {
  const { data: policies } = useAiPolicies(storeId)
  const upsert = useUpsertAiPolicies(storeId)

  const [form, setForm] = useState<FundamentForm>(EMPTY)
  const [init, setInit] = useState<FundamentForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const seeded = rowToForm(policies)
    setForm(seeded)
    setInit(seeded)
  }, [policies])

  const isDirty =
    form.brand_name              !== init.brand_name ||
    form.brand_description       !== init.brand_description ||
    form.industry                !== init.industry ||
    form.formality_level         !== init.formality_level ||
    form.personality_preferences !== init.personality_preferences ||
    form.tone_of_voice           !== init.tone_of_voice ||
    form.sign_off                !== init.sign_off ||
    form.website_url             !== init.website_url ||
    !sameList(form.product_categories,  init.product_categories) ||
    !sameList(form.communication_style, init.communication_style) ||
    !sameList(form.languages,           init.languages)

  // Completeness mirrors the gate in lib/services/ai-onboarding.ts:
  // brand_name + industry + tone_of_voice + sign_off all non-empty.
  const isComplete = !!(
    policies?.brand_name?.trim() &&
    policies?.industry?.trim() &&
    policies?.tone_of_voice?.trim() &&
    policies?.sign_off?.trim()
  )

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    try {
      await upsert.mutateAsync({
        brand_name:              form.brand_name,
        brand_description:       form.brand_description,
        industry:                form.industry,
        product_categories:      form.product_categories,
        formality_level:         form.formality_level === '' ? null : form.formality_level,
        communication_style:     form.communication_style,
        personality_preferences: form.personality_preferences,
        tone_of_voice:           form.tone_of_voice,
        sign_off:                form.sign_off,
        languages:               form.languages,
        website_url:             form.website_url,
      })
      setInit(form)
    } finally {
      setSaving(false)
    }
  }

  const patch = (p: Partial<FundamentForm>) => setForm((prev) => ({ ...prev, ...p }))

  return (
    <SettingsSection
      title="Fundamentals"
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
            <Button onClick={() => void handleSave()} disabled={!isDirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-5">
          {/* Figma-defined fields first, in Figma order (node 1056-13). */}
          <SettingsField emphasizeLabel label="Brand name" htmlFor="ai-brand-name">
            <Input
              id="ai-brand-name"
              type="text"
              value={form.brand_name}
              onChange={(e) => patch({ brand_name: e.target.value })}
              placeholder="e.g. Acme Co"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField emphasizeLabel
            label="Brand description"
            htmlFor="ai-brand-description"
            hint="What you sell and what makes the brand distinctive."
          >
            <Textarea
              id="ai-brand-description"
              value={form.brand_description}
              onChange={(e) => patch({ brand_description: e.target.value })}
              placeholder="A short description of the brand and product range…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField emphasizeLabel
            label="Tone of voice"
            htmlFor="ai-tone"
            hint="e.g. Warm & personal, Professional & efficient."
          >
            <Input
              id="ai-tone"
              type="text"
              value={form.tone_of_voice}
              onChange={(e) => patch({ tone_of_voice: e.target.value })}
              placeholder="How replies should sound"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField emphasizeLabel
            label="Sign-off"
            htmlFor="ai-sign-off"
            hint="The closing line of every reply — e.g. “Kind regards, the Acme team.”"
          >
            <Input
              id="ai-sign-off"
              type="text"
              value={form.sign_off}
              onChange={(e) => patch({ sign_off: e.target.value })}
              placeholder="Kind regards, the team"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField emphasizeLabel
            label="Languages"
            hint="Languages the agent may reply in. Type and press Enter."
          >
            <ChipInput
              value={form.languages}
              onChange={(languages) => patch({ languages })}
              placeholder="e.g. English, Nederlands…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField emphasizeLabel label="Website URL" htmlFor="ai-website">
            <Input
              id="ai-website"
              type="text"
              value={form.website_url}
              onChange={(e) => patch({ website_url: e.target.value })}
              placeholder="https://example.com"
              disabled={!canEdit}
            />
          </SettingsField>

          {/* Extra fields retained beyond Figma (kept per product decision). */}
          <SettingsField emphasizeLabel label="Industry" htmlFor="ai-industry">
            <Input
              id="ai-industry"
              type="text"
              value={form.industry}
              onChange={(e) => patch({ industry: e.target.value })}
              placeholder="e.g. Fashion, Electronics, Health & beauty"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField emphasizeLabel
            label="Product categories"
            hint="Main categories you sell. Type and press Enter."
          >
            <ChipInput
              value={form.product_categories}
              onChange={(product_categories) => patch({ product_categories })}
              placeholder="e.g. Sneakers, Outerwear…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField emphasizeLabel
            label="Formality"
            htmlFor="ai-formality"
            hint="How formal should replies sound?"
          >
            <Select
              value={form.formality_level === '' ? undefined : form.formality_level}
              onValueChange={(v) =>
                patch({ formality_level: (v as FundamentForm['formality_level']) || '' })
              }
            >
              <SelectTrigger id="ai-formality" className="w-full max-w-xs" disabled={!canEdit}>
                <SelectValue placeholder="Pick a level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField emphasizeLabel
            label="Communication style"
            hint="Style traits to combine. Type and press Enter (e.g. concise, empathetic, playful)."
          >
            <ChipInput
              value={form.communication_style}
              onChange={(communication_style) => patch({ communication_style })}
              placeholder="e.g. concise, empathetic…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField emphasizeLabel
            label="Personality preferences"
            htmlFor="ai-personality"
            hint="Free-text notes on how Emma should come across (e.g. confident, dry humour, no exclamation marks)."
          >
            <Textarea
              id="ai-personality"
              value={form.personality_preferences}
              onChange={(e) => patch({ personality_preferences: e.target.value })}
              placeholder="Describe the personality you want Emma to project…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
