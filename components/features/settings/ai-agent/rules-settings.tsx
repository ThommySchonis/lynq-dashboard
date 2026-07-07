'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bot } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { SettingsEmptyState } from '@/components/features/settings/settings-empty-state'
import { AiStoreSelect } from './ai-store-select'
import { AutomationMode, type AutomationModeValue } from './automation-mode'
import { SuggestOnlyInfo } from "./suggest-only-info";
import { PerScenarioControl } from './per-scenario-control'
import { useAuthStore } from '@/stores/auth'
import { useAiAutonomyRules, useUpsertAiAutonomyRules, useAiStoreSelection } from '@/hooks/ai'
import { useStoreAiSettings, useUpdateStoreAiSettings } from '@/hooks/stores'
import type { AiAutonomyRulesConfig, ReplyIntent } from '@/lib/schemas/ai'
import { DEFAULT_AUTONOMY_CONFIG } from '@/lib/schemas/ai'

const HEADER_TITLE = 'Auto-send rules'
const HEADER_DESC =
  'Control when Emma is allowed to send replies autonomously, without human review.'

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
  const upsertRules = useUpsertAiAutonomyRules(storeId)
  const { data: aiSettings } = useStoreAiSettings(storeId)
  const updateAiSettings = useUpdateStoreAiSettings(storeId)

  // ── Local form state, seeded from the server (or default) config. Every
  // control saves instantly, so there is no separate dirty/baseline copy. ──
  const [form, setForm] = useState<AiAutonomyRulesConfig>(freshDefaultConfig)

  useEffect(() => {
    if (rulesResp) {
      setForm(rulesResp.config ?? freshDefaultConfig())
    }
  }, [rulesResp])

  // ── Automation mode ──
  // Auto-send is on only when BOTH the store flag and the config master switch
  // are enabled; the two are flipped together so the binary stays unambiguous.
  const autoSendOn = (aiSettings?.ai_auto_send_enabled ?? false) && form.master_enabled
  const mode: AutomationModeValue = autoSendOn ? 'auto' : 'suggest'

  async function selectMode(next: AutomationModeValue) {
    if (!canEdit || next === mode) return
    const auto = next === 'auto'
    // Emma always drafts (auto-generate stays on in both modes); the store flag
    // and the master switch mirror the chosen mode. Instant save.
    const nextConfig: AiAutonomyRulesConfig = { ...form, master_enabled: auto }
    setForm(nextConfig)
    await Promise.all([
      updateAiSettings.mutateAsync({ ai_auto_generate: true, ai_auto_send_enabled: auto }),
      upsertRules.mutateAsync(nextConfig),
    ])
  }

  // Persist the confidence threshold on slider release (instant save).
  async function commitConfidence(pct: number) {
    if (!canEdit) return
    await upsertRules.mutateAsync({ ...form, confidence_threshold: pct / 100 })
  }

  // Toggle a scenario's auto-send by adding/removing its intent from the global
  // block list (Review only ⇔ intent blocked). Instant save.
  async function toggleScenario(intent: ReplyIntent, autoSend: boolean) {
    if (!canEdit) return
    const nextConfig: AiAutonomyRulesConfig = {
      ...form,
      global_block_intents: autoSend
        ? form.global_block_intents.filter((i) => i !== intent)
        : Array.from(new Set([...form.global_block_intents, intent])),
    }
    setForm(nextConfig)
    await upsertRules.mutateAsync(nextConfig)
  }

  // ── Loading skeleton (stores still loading) ──
  if (storesLoading) {
    return (
      <div className="mx-auto max-w-[920px] px-6 py-10">
        <SettingsPageHeader title={HEADER_TITLE} description={HEADER_DESC} />
        <div className="flex flex-col gap-10">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  const showSections = !!storeId && !rulesLoading
  const thresholdPct = Math.round(form.confidence_threshold * 100)

  return (
    <div className="mx-auto max-w-[920px] px-6 py-10">
      <SettingsPageHeader title={HEADER_TITLE} description={HEADER_DESC} />

      {!stores || stores.length === 0 ? (
        <div className="flex items-center justify-center pt-6">
          <div className="w-[440px] max-w-full rounded-2xl border border-settings-border bg-card px-10 py-7">
            <SettingsEmptyState
              Icon={Bot}
              title="No stores yet"
              description="Connect a store first to configure its AI agent. Stores can be added under Settings → Stores."
              action={<Button render={<Link href="/settings/workspace/stores" />}>Connect store</Button>}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <AiStoreSelect stores={stores} storeId={storeId} onChange={setStore} />
          </div>

          {!showSections ? (
            <div className="flex flex-col gap-10">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-72 w-full rounded-xl" />
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              <AutomationMode value={mode} onSelect={(v) => void selectMode(v)} disabled={!canEdit} />

              {mode === "suggest" && <SuggestOnlyInfo />}

              {/* Auto-send conditions — confidence threshold (Figma 1068-54…67) */}
              {mode === "auto" && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-bold text-foreground">Auto-send conditions</h2>
                    <p className="text-sm font-medium text-muted-foreground">
                      Emma auto-sends only when the confidence score is high enough and none of the guardrails apply.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-settings-border bg-card p-[22px]">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">Minimum confidence to auto-send</span>
                        <span className="rounded-full bg-accent-soft px-2.5 py-[3px] text-xs font-semibold text-primary-hover">{thresholdPct}%</span>
                      </div>
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={thresholdPct}
                        onValueChange={(v) =>
                          setForm((prev) => ({
                            ...prev,
                            confidence_threshold: (typeof v === "number" ? v : 0) / 100,
                          }))
                        }
                        onValueCommitted={(v) => void commitConfidence(typeof v === "number" ? v : 0)}
                        disabled={!canEdit}
                      />
                      <p className="text-xs font-medium text-muted-foreground">
                        Replies scoring below {thresholdPct}% are sent to the inbox for review instead.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-scenario control (Figma 1068-108…168) */}
              {mode === "auto" && (
                <PerScenarioControl
                  storeId={storeId}
                  blockedIntents={form.global_block_intents}
                  onToggle={(intent, autoSend) => void toggleScenario(intent, autoSend)}
                  disabled={!canEdit}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
