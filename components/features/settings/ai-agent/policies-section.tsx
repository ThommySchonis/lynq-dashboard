'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsField } from '@/components/features/settings/settings-field'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { ChipInput } from '@/components/shared/chip-input'

export interface PoliciesValues {
  shipping_policy: string
  refund_policy: string
  customs_policy: string
  can_decide: string[]
  cannot_decide: string[]
  escalate_triggers: string[]
  tracking_url: string
}

interface PoliciesSectionProps {
  values: PoliciesValues
  canEdit: boolean
  isSaving: boolean
  isDirty: boolean
  isComplete: boolean
  onChange: (patch: Partial<PoliciesValues>) => void
  onSave: () => void
}

export function PoliciesSection({
  values,
  canEdit,
  isSaving,
  isDirty,
  isComplete,
  onChange,
  onSave,
}: PoliciesSectionProps) {
  return (
    <SettingsSection
      title="Policies & regels"
      description="The rules and boundaries the AI agent follows when resolving tickets."
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
          <SettingsField label="Shipping policy" htmlFor="ai-shipping">
            <Textarea
              id="ai-shipping"
              value={values.shipping_policy}
              onChange={(e) => onChange({ shipping_policy: e.target.value })}
              placeholder="Delivery times, carriers, costs…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField label="Refund policy" htmlFor="ai-refund">
            <Textarea
              id="ai-refund"
              value={values.refund_policy}
              onChange={(e) => onChange({ refund_policy: e.target.value })}
              placeholder="When refunds are granted, partial vs full, timeframe…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField label="Customs policy" htmlFor="ai-customs">
            <Textarea
              id="ai-customs"
              value={values.customs_policy}
              onChange={(e) => onChange({ customs_policy: e.target.value })}
              placeholder="How import duties and customs fees are handled…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField
            label="Agent can decide"
            hint="Things the agent may resolve on its own. Type and press Enter."
          >
            <ChipInput
              value={values.can_decide}
              onChange={(can_decide) => onChange({ can_decide })}
              placeholder="e.g. Resend tracking link…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField
            label="Agent cannot decide"
            hint="Things the agent must never decide on its own."
          >
            <ChipInput
              value={values.cannot_decide}
              onChange={(cannot_decide) => onChange({ cannot_decide })}
              placeholder="e.g. Approve refunds over €100…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField
            label="Escalate triggers"
            hint="Situations that should always be handed to a human."
          >
            <ChipInput
              value={values.escalate_triggers}
              onChange={(escalate_triggers) => onChange({ escalate_triggers })}
              placeholder="e.g. Legal threat, chargeback…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField label="Tracking URL" htmlFor="ai-tracking">
            <Input
              id="ai-tracking"
              type="text"
              value={values.tracking_url}
              onChange={(e) => onChange({ tracking_url: e.target.value })}
              placeholder="https://track.example.com/{tracking_number}"
              disabled={!canEdit}
            />
          </SettingsField>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
