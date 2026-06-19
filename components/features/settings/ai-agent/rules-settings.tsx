'use client'

import { useState, useEffect } from 'react'
import { Bot, Lock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
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
import { SettingsToggle } from '@/components/features/settings/settings-toggle'
import { EmptyState } from '@/components/shared/empty-state'
import { useAuthStore } from '@/stores/auth'
import {
  useAiAutonomyRules,
  useUpsertAiAutonomyRules,
  useAiScenarios,
  useAiStoreSelection,
} from '@/hooks/ai'
import { useStoreAiSettings, useUpdateStoreAiSettings } from '@/hooks/stores'
import type { AiAutonomyRulesConfig } from '@/lib/schemas/ai'
import { REPLY_INTENTS, DEFAULT_AUTONOMY_CONFIG } from '@/lib/schemas/ai'
import { SCENARIOS } from './scenarios-section'

// Human-readable label for each of the 9 REPLY_INTENTS. Mirrors the titles
// from SCENARIOS for the 7 canonical scenario keys; adds the two intent-only
// values (other / unknown) which don't have a scenario row.
const INTENT_LABELS: Record<(typeof REPLY_INTENTS)[number], string> = {
  wismo:                'Where is my order?',
  long_delivery:        'Long delivery time',
  lost_package:         'Lost package',
  wrong_or_damaged:     'Wrong or damaged item',
  refund_or_cancel:     'Refund or cancellation',
  customs_fees:         'Customs fees',
  angry_or_chargeback:  'Angry customer or chargeback',
  other:                'Other (on-topic but unmapped)',
  unknown:              'Unknown / off-topic',
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

// Clone DEFAULT_AUTONOMY_CONFIG into a fresh mutable AiAutonomyRulesConfig.
// The schema export is `as const` (readonly tuple) so we can't pass it
// directly to a useState that holds a mutable shape.
const freshDefaultConfig = (): AiAutonomyRulesConfig => ({
  master_enabled:       DEFAULT_AUTONOMY_CONFIG.master_enabled,
  confidence_threshold: DEFAULT_AUTONOMY_CONFIG.confidence_threshold,
  global_block_intents: [...DEFAULT_AUTONOMY_CONFIG.global_block_intents],
})

export function RulesSettings() {
  const role = useAuthStore((s) => s.role)
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const canEdit = !isSuspended && (role === 'owner' || role === 'admin')

  // ── Store selection (persisted in ?store=) ──
  const { storeId, setStore, stores, storesLoading } = useAiStoreSelection()

  // ── Server data ──
  const { data: rulesResp, isLoading: rulesLoading } = useAiAutonomyRules(storeId)
  const { data: scenarios } = useAiScenarios(storeId)
  const upsertRules = useUpsertAiAutonomyRules(storeId)
  const { data: aiSettings } = useStoreAiSettings(storeId)
  const updateAiSettings = useUpdateStoreAiSettings(storeId)

  // ── Local form state, seeded from the server (or default) config ──
  const [form, setForm] = useState<AiAutonomyRulesConfig>(freshDefaultConfig)
  const [init, setInit] = useState<AiAutonomyRulesConfig>(freshDefaultConfig)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (rulesResp) {
      const next = rulesResp.config ?? freshDefaultConfig()
      setForm(next)
      setInit(next)
    }
  }, [rulesResp])

  const isDirty =
    form.master_enabled !== init.master_enabled ||
    form.confidence_threshold !== init.confidence_threshold ||
    !sameList(form.global_block_intents, init.global_block_intents)

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    try {
      await upsertRules.mutateAsync(form)
      setInit(form)
    } finally {
      setSaving(false)
    }
  }

  function toggleBlockedIntent(intent: (typeof REPLY_INTENTS)[number], checked: boolean) {
    setForm((prev) => ({
      ...prev,
      global_block_intents: checked
        ? Array.from(new Set([...prev.global_block_intents, intent]))
        : prev.global_block_intents.filter((i) => i !== intent),
    }))
  }

  // ── Loading skeleton (stores still loading) ──
  if (storesLoading) {
    return (
      <div className="max-w-3xl mx-auto px-12 py-12 space-y-10">
        <div className="space-y-2 pb-6 border-b border-border">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  const showSections = !!storeId && !rulesLoading
  const thresholdPct = Math.round(form.confidence_threshold * 100)

  return (
    <div className="max-w-3xl mx-auto px-12 py-12">
      {/* Header */}
      <div className="pb-6 mb-8 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 flex-wrap">
          <span>Settings</span>
          <span>/</span>
          <span>AI agent</span>
          <span>/</span>
          <span>Rules</span>
        </div>
        <h1 className="text-[28px] font-semibold text-foreground leading-tight mb-1">
          Auto-send rules
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Control when Emma is allowed to send replies autonomously, without
          human review.
        </p>
      </div>

      {!stores || stores.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No stores yet"
          description="Connect a store first to configure its AI agent. Stores can be added under Settings → Stores."
        />
      ) : (
        <>
          {/* Store selector */}
          <div className="mb-8 flex flex-col gap-1.5 max-w-xs">
            <Label htmlFor="ai-rules-store-select" className="text-sm font-medium text-foreground">
              Store
            </Label>
            <Select value={storeId} onValueChange={(v) => v && setStore(v)}>
              <SelectTrigger id="ai-rules-store-select" className="w-full">
                <SelectValue placeholder="Select a store">
                  {stores?.find((s) => s.id === storeId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!showSections ? (
            <div className="flex flex-col gap-10">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-72 w-full rounded-xl" />
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {/* AI generation & auto-send store-level toggles */}
              <SettingsSection
                title="AI suggestions"
                description="Control whether Emma automatically generates draft replies when new customer messages arrive."
              >
                <SettingsCard>
                  <div className="flex flex-col gap-4">
                    <SettingsToggle
                      id="ai-auto-generate"
                      label="Auto-generate suggestions"
                      description="Emma drafts a reply when a new inbound message arrives. Agents review before sending."
                      checked={aiSettings?.ai_auto_generate ?? false}
                      onCheckedChange={(checked) =>
                        void updateAiSettings.mutateAsync({ ai_auto_generate: checked })
                      }
                      disabled={!canEdit}
                    />
                    <SettingsToggle
                      id="ai-auto-send-enabled"
                      label="Enable auto-send"
                      description="Allow high-confidence replies to be sent automatically, subject to the rules below. When off, every reply goes through suggest mode."
                      checked={aiSettings?.ai_auto_send_enabled ?? false}
                      onCheckedChange={(checked) =>
                        void updateAiSettings.mutateAsync({ ai_auto_send_enabled: checked })
                      }
                      disabled={!canEdit}
                    />
                  </div>
                </SettingsCard>
              </SettingsSection>

              {/* Master toggle */}
              <SettingsSection
                title="Master switch"
                description="The kill-switch for auto-send. When off, every reply goes through suggest mode regardless of the rules below."
              >
                <SettingsCard>
                  <SettingsToggle
                    id="ai-master-enabled"
                    label="Allow Emma to send replies autonomously"
                    description="When enabled, Emma automatically sends replies that match all the rules below. When disabled, all replies go through suggest mode."
                    checked={form.master_enabled}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, master_enabled: checked }))
                    }
                    disabled={!canEdit}
                  />
                </SettingsCard>
              </SettingsSection>

              {/* Confidence threshold */}
              <SettingsSection
                title="Confidence threshold"
                description="Emma only auto-sends when her own confidence is above this threshold. Lower = more autonomous, higher = more conservative."
              >
                <SettingsCard>
                  <SettingsField label="Minimum confidence to auto-send">
                    <div className="flex items-center gap-3">
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={thresholdPct}
                        onValueChange={(v) =>
                          setForm((prev) => ({
                            ...prev,
                            confidence_threshold:
                              (typeof v === 'number' ? v : 0) / 100,
                          }))
                        }
                        disabled={!canEdit}
                        className="flex-1"
                      />
                      <span className="text-sm tabular-nums w-12 text-right text-foreground">
                        {thresholdPct}%
                      </span>
                    </div>
                  </SettingsField>
                </SettingsCard>
              </SettingsSection>

              {/* Block list */}
              <SettingsSection
                title="Blocked intents"
                description="Intents in this list NEVER auto-send. Emma still drafts a reply but routes it through suggest mode."
              >
                <SettingsCard>
                  <div className="flex flex-col gap-2.5">
                    {REPLY_INTENTS.map((intent) => {
                      const checked = form.global_block_intents.includes(intent)
                      return (
                        <label
                          key={intent}
                          className="flex items-start gap-3 cursor-pointer group/intent"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => toggleBlockedIntent(intent, c === true)}
                            disabled={!canEdit}
                            className="mt-0.5"
                          />
                          <span className="text-sm text-foreground group-has-disabled/intent:opacity-50">
                            {INTENT_LABELS[intent]}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </SettingsCard>
              </SettingsSection>

              {/* Per-scenario autonomy thresholds (read-only) */}
              <SettingsSection
                title="Per-scenario thresholds"
                description="Per-scenario thresholds are set on the Onboarding page. Emma uses the higher of this value and the store-wide threshold above."
              >
                <SettingsCard>
                  <div className="flex flex-col divide-y divide-border">
                    {SCENARIOS.map((meta) => {
                      const row = scenarios?.find((s) => s.scenario_key === meta.key)
                      const pct = row?.autonomy_pct ?? 0
                      const locked = !!meta.lockAutonomy
                      return (
                        <div
                          key={meta.key}
                          className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                        >
                          <span className="text-sm text-foreground">{meta.title}</span>
                          {locked ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="size-3" />
                              Locked at 0%
                            </span>
                          ) : (
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {pct}%
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </SettingsCard>
              </SettingsSection>

              {/* Save bar */}
              {canEdit && (
                <div className="flex justify-end">
                  <Button onClick={() => void handleSave()} disabled={!isDirty || saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
