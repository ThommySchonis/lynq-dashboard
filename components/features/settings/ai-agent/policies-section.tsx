'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsField } from '@/components/features/settings/settings-field'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { ChipInput } from '@/components/shared/chip-input'
import { useAiPolicies, useUpsertAiPolicies } from '@/hooks/ai'
import type { AiPoliciesRow } from '@/hooks/ai'

interface PoliciesForm {
  shipping_policy: string
  refund_policy: string
  cancellation_policy: string
  customs_policy: string
  can_decide: string[]
  cannot_decide: string[]
  escalate_triggers: string[]
  tracking_url: string
}

const EMPTY: PoliciesForm = {
  shipping_policy: '',
  refund_policy: '',
  cancellation_policy: '',
  customs_policy: '',
  can_decide: [],
  cannot_decide: [],
  escalate_triggers: [],
  tracking_url: '',
}

function rowToForm(row: AiPoliciesRow | null | undefined): PoliciesForm {
  return {
    shipping_policy:     row?.shipping_policy     ?? '',
    refund_policy:       row?.refund_policy       ?? '',
    cancellation_policy: row?.cancellation_policy ?? '',
    customs_policy:      row?.customs_policy      ?? '',
    can_decide:          row?.can_decide          ?? [],
    cannot_decide:       row?.cannot_decide       ?? [],
    escalate_triggers:   row?.escalate_triggers   ?? [],
    tracking_url:        row?.tracking_url        ?? '',
  }
}

const sameList = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)

interface PoliciesSectionProps {
  storeId: string
  canEdit: boolean
}

export function PoliciesSection({ storeId, canEdit }: PoliciesSectionProps) {
  const { data: policies } = useAiPolicies(storeId)
  const upsert = useUpsertAiPolicies(storeId)

  const [form, setForm] = useState<PoliciesForm>(EMPTY)
  const [init, setInit] = useState<PoliciesForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const seeded = rowToForm(policies)
    setForm(seeded)
    setInit(seeded)
  }, [policies])

  const isDirty =
    form.shipping_policy     !== init.shipping_policy ||
    form.refund_policy       !== init.refund_policy ||
    form.cancellation_policy !== init.cancellation_policy ||
    form.customs_policy      !== init.customs_policy ||
    form.tracking_url        !== init.tracking_url ||
    !sameList(form.can_decide,        init.can_decide) ||
    !sameList(form.cannot_decide,     init.cannot_decide) ||
    !sameList(form.escalate_triggers, init.escalate_triggers)

  // Mirrors the gate in lib/services/ai-onboarding.ts:
  // shipping + refund + cancellation policies non-empty; can_decide +
  // escalate_triggers non-empty arrays.
  const isComplete = !!(
    policies?.shipping_policy?.trim() &&
    policies?.refund_policy?.trim() &&
    policies?.cancellation_policy?.trim() &&
    policies?.can_decide?.length &&
    policies?.escalate_triggers?.length
  )

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    try {
      await upsert.mutateAsync({
        shipping_policy:     form.shipping_policy,
        refund_policy:       form.refund_policy,
        cancellation_policy: form.cancellation_policy,
        customs_policy:      form.customs_policy,
        can_decide:          form.can_decide,
        cannot_decide:       form.cannot_decide,
        escalate_triggers:   form.escalate_triggers,
        tracking_url:        form.tracking_url,
      })
      setInit(form)
    } finally {
      setSaving(false)
    }
  }

  const patch = (p: Partial<PoliciesForm>) => setForm((prev) => ({ ...prev, ...p }))

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
            <Button onClick={() => void handleSave()} disabled={!isDirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-5">
          <SettingsField label="Shipping policy" htmlFor="ai-shipping">
            <Textarea
              id="ai-shipping"
              value={form.shipping_policy}
              onChange={(e) => patch({ shipping_policy: e.target.value })}
              placeholder="Delivery times, carriers, costs…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField label="Returns & refunds policy" htmlFor="ai-refund">
            <Textarea
              id="ai-refund"
              value={form.refund_policy}
              onChange={(e) => patch({ refund_policy: e.target.value })}
              placeholder="When returns / refunds are granted, partial vs full, timeframe…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField label="Cancellation policy" htmlFor="ai-cancellation">
            <Textarea
              id="ai-cancellation"
              value={form.cancellation_policy}
              onChange={(e) => patch({ cancellation_policy: e.target.value })}
              placeholder="When customers can cancel, how to request, who pays for what…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField label="Customs policy" htmlFor="ai-customs">
            <Textarea
              id="ai-customs"
              value={form.customs_policy}
              onChange={(e) => patch({ customs_policy: e.target.value })}
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
              value={form.can_decide}
              onChange={(can_decide) => patch({ can_decide })}
              placeholder="e.g. Resend tracking link…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField
            label="Agent cannot decide"
            hint="Things the agent must never decide on its own."
          >
            <ChipInput
              value={form.cannot_decide}
              onChange={(cannot_decide) => patch({ cannot_decide })}
              placeholder="e.g. Approve refunds over €100…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField
            label="Escalate triggers"
            hint="Situations that should always be handed to a human."
          >
            <ChipInput
              value={form.escalate_triggers}
              onChange={(escalate_triggers) => patch({ escalate_triggers })}
              placeholder="e.g. Legal threat, chargeback…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField label="Tracking URL" htmlFor="ai-tracking">
            <Input
              id="ai-tracking"
              type="text"
              value={form.tracking_url}
              onChange={(e) => patch({ tracking_url: e.target.value })}
              placeholder="https://track.example.com/{tracking_number}"
              disabled={!canEdit}
            />
          </SettingsField>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
