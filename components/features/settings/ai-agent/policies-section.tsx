'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
  CAN_DECIDE_PREDEFINED,
  CANNOT_DECIDE_PREDEFINED,
  CANCELLATION_WINDOW_OPTIONS,
} from '@/lib/constants/emma-onboarding'
import type { CancellationWindowKey } from '@/lib/schemas/ai'

export interface PoliciesValues {
  shipping_policy:        string
  refund_policy:          string
  customs_policy:         string
  can_decide_options:     string[]
  can_decide_notes:       string
  cannot_decide_options:  string[]
  cannot_decide_notes:    string
  parcelpanel_url:        string
  cancellation_window:    CancellationWindowKey
  tracking_url:           string
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

const CW_KEYS = CANCELLATION_WINDOW_OPTIONS.map((o) => o.key) as readonly CancellationWindowKey[]
const isCwKey = (v: string): v is CancellationWindowKey =>
  (CW_KEYS as readonly string[]).includes(v)

interface OptionListProps {
  items:    string[]
  selected: string[]
  canEdit:  boolean
  onToggle: (item: string, checked: boolean) => void
  idPrefix: string
}

function OptionList({ items, selected, canEdit, onToggle, idPrefix }: OptionListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const id = `${idPrefix}-${i}`
        const checked = selected.includes(item)
        return (
          <label
            key={item}
            htmlFor={id}
            className="flex items-start gap-3 cursor-pointer group/option"
          >
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(c) => onToggle(item, c === true)}
              disabled={!canEdit}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground group-has-disabled/option:opacity-50">
              {item}
            </span>
          </label>
        )
      })}
    </div>
  )
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
  function toggleCanDecide(item: string, checked: boolean) {
    onChange({
      can_decide_options: checked
        ? Array.from(new Set([...values.can_decide_options, item]))
        : values.can_decide_options.filter((v) => v !== item),
    })
  }

  function toggleCannotDecide(item: string, checked: boolean) {
    onChange({
      cannot_decide_options: checked
        ? Array.from(new Set([...values.cannot_decide_options, item]))
        : values.cannot_decide_options.filter((v) => v !== item),
    })
  }

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
        <div className="flex flex-col gap-6">
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
            hint="Pick what Emma may resolve on her own. Add aanvullende notities hieronder."
          >
            <OptionList
              items={CAN_DECIDE_PREDEFINED}
              selected={values.can_decide_options}
              canEdit={canEdit}
              onToggle={toggleCanDecide}
              idPrefix="ai-can-decide"
            />
          </SettingsField>

          <SettingsField label="Aanvullende notities (can decide)" htmlFor="ai-can-decide-notes">
            <Textarea
              id="ai-can-decide-notes"
              value={values.can_decide_notes}
              onChange={(e) => onChange({ can_decide_notes: e.target.value })}
              placeholder="Brand-specifieke aanvullingen voor wat Emma zelfstandig mag doen…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField
            label="Agent cannot decide"
            hint="Pick wat Emma nooit zelfstandig mag beslissen. Aanvullende notities hieronder."
          >
            <OptionList
              items={CANNOT_DECIDE_PREDEFINED}
              selected={values.cannot_decide_options}
              canEdit={canEdit}
              onToggle={toggleCannotDecide}
              idPrefix="ai-cannot-decide"
            />
          </SettingsField>

          <SettingsField label="Aanvullende notities (cannot decide)" htmlFor="ai-cannot-decide-notes">
            <Textarea
              id="ai-cannot-decide-notes"
              value={values.cannot_decide_notes}
              onChange={(e) => onChange({ cannot_decide_notes: e.target.value })}
              placeholder="Brand-specifieke aanvullingen voor wat Emma nooit mag doen…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField
            label="ParcelPanel tracking URL"
            htmlFor="ai-parcelpanel"
            hint="Statische tracking-URL waarmee Emma klanten doorverwijst voor actuele status."
          >
            <Input
              id="ai-parcelpanel"
              type="text"
              value={values.parcelpanel_url}
              onChange={(e) => onChange({ parcelpanel_url: e.target.value })}
              placeholder="https://track.example.com"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField
            label="Cancellation window"
            htmlFor="ai-cancellation-window"
            hint="Hoe lang na een bestelling kan een klant nog annuleren?"
          >
            <Select
              value={values.cancellation_window}
              onValueChange={(v) => {
                if (v && isCwKey(v)) onChange({ cancellation_window: v })
              }}
              disabled={!canEdit}
            >
              <SelectTrigger id="ai-cancellation-window" className="w-full max-w-xs">
                <SelectValue placeholder="Kies een window" />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_WINDOW_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField label="Tracking URL template" htmlFor="ai-tracking">
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
