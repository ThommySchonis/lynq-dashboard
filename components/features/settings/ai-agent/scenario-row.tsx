'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { SettingsField } from '@/components/features/settings/settings-field'
import { SettingsToggle } from '@/components/features/settings/settings-toggle'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { useUpsertAiScenario } from '@/hooks/ai'
import type { AiScenarioRow } from '@/hooks/ai'
import type { ScenarioMeta } from './scenarios-section'

// Five-field scenario form post Emma onboarding refactor.
// Field order in the UI: Triggers → Approach → Must do → Must not do →
// Escalate when (mirrors the prompt-builder render order so the merchant
// sees the same shape Emma sees).
interface ScenarioForm {
  triggers:      string
  approach:      string
  must_do:       string
  must_not_do:   string
  escalate_when: string
  autonomy_pct:  number
  enabled:       boolean
}

function rowToForm(row: AiScenarioRow | undefined): ScenarioForm {
  return {
    triggers:      row?.triggers ?? '',
    approach:      row?.approach ?? '',
    must_do:       row?.must_do ?? '',
    must_not_do:   row?.must_not_do ?? '',
    escalate_when: row?.escalate_when ?? '',
    autonomy_pct:  row?.autonomy_pct ?? 0,
    enabled:       row?.enabled ?? true,
  }
}

interface ScenarioRowProps {
  meta: ScenarioMeta
  storeId: string
  canEdit: boolean
  row: AiScenarioRow | undefined
  first: boolean
  last: boolean
}

export function ScenarioRow({ meta, storeId, canEdit, row, first, last }: ScenarioRowProps) {
  const locked = !!meta.lockAutonomy
  const upsert = useUpsertAiScenario(storeId)

  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState<ScenarioForm>(rowToForm(row))
  const [init, setInit] = useState<ScenarioForm>(rowToForm(row))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const seeded = rowToForm(row)
    setForm(seeded)
    setInit(seeded)
  }, [row])

  const update = (patch: Partial<ScenarioForm>) => setForm((prev) => ({ ...prev, ...patch }))

  // A scenario counts as complete once it has ALL 5 fields filled (mirrors
  // getOnboardingStatus per Notion §6 and the page-level scenariosComplete
  // check in onboarding-settings.tsx).
  const complete = !!(
    form.triggers.trim() &&
    form.approach.trim() &&
    form.must_do.trim() &&
    form.must_not_do.trim() &&
    form.escalate_when.trim()
  )

  const isDirty =
    form.triggers      !== init.triggers ||
    form.approach      !== init.approach ||
    form.must_do       !== init.must_do ||
    form.must_not_do   !== init.must_not_do ||
    form.escalate_when !== init.escalate_when ||
    form.autonomy_pct  !== init.autonomy_pct ||
    form.enabled       !== init.enabled

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    try {
      const payload: ScenarioForm = { ...form, autonomy_pct: locked ? 0 : form.autonomy_pct }
      await upsert.mutateAsync({
        scenario_key:  meta.key,
        title:         meta.title,
        triggers:      payload.triggers,
        approach:      payload.approach,
        must_do:       payload.must_do,
        must_not_do:   payload.must_not_do,
        escalate_when: payload.escalate_when,
        autonomy_pct:  payload.autonomy_pct,
        enabled:       payload.enabled,
      })
      setInit(payload)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('py-4', first && 'pt-0', last && !expanded && 'pb-0')}>
      {/* Header row — click to expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{meta.title}</span>
          <StatusBadge
            status={complete ? 'active' : 'pending'}
            label={complete ? 'Complete' : 'Incomplete'}
          />
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="mt-4 flex flex-col gap-5">
          <SettingsField
            label="Triggers"
            htmlFor={`sc-${meta.key}-triggers`}
            hint="Customer signals that make this scenario fire (key phrases, intent shape)."
          >
            <Textarea
              id={`sc-${meta.key}-triggers`}
              value={form.triggers}
              onChange={(e) => update({ triggers: e.target.value })}
              placeholder="Bijv. vragen over verzending, &ldquo;wanneer komt het&rdquo;, track-and-trace werkt niet…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField
            label="Approach"
            htmlFor={`sc-${meta.key}-approach`}
            hint="The tone + framing Emma should use for this scenario."
          >
            <Textarea
              id={`sc-${meta.key}-approach`}
              value={form.approach}
              onChange={(e) => update({ approach: e.target.value })}
              placeholder="Describe the approach…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField
            label="Must do"
            htmlFor={`sc-${meta.key}-must-do`}
            hint="Non-negotiable steps Emma always takes in this scenario."
          >
            <Textarea
              id={`sc-${meta.key}-must-do`}
              value={form.must_do}
              onChange={(e) => update({ must_do: e.target.value })}
              placeholder="Bijv. altijd de ParcelPanel link meesturen…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField
            label="Must not do"
            htmlFor={`sc-${meta.key}-must-not-do`}
            hint="Explicit no-gos. These override any example phrasing."
          >
            <Textarea
              id={`sc-${meta.key}-must-not-do`}
              value={form.must_not_do}
              onChange={(e) => update({ must_not_do: e.target.value })}
              placeholder="Bijv. nooit Chinese carrier tracking link sturen…"
              disabled={!canEdit}
              rows={3}
            />
          </SettingsField>

          <SettingsField
            label="Escalate when"
            htmlFor={`sc-${meta.key}-escalate`}
            hint="When this scenario should be handed to a human."
          >
            <Textarea
              id={`sc-${meta.key}-escalate`}
              value={form.escalate_when}
              onChange={(e) => update({ escalate_when: e.target.value })}
              placeholder="Bijv. tracking >7 dagen geen movement…"
              disabled={!canEdit}
              rows={2}
            />
          </SettingsField>

          {/* Autonomy */}
          <SettingsField
            label="Autonomy"
            hint="How much of this scenario the agent may resolve without a human."
          >
            {locked ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 opacity-50">
                  <Slider min={0} max={100} step={5} value={0} disabled />
                </div>
                <span className="text-sm tabular-nums w-10 text-right text-muted-foreground">0%</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                      <Lock className="size-3" />
                      Locked
                    </TooltipTrigger>
                    <TooltipContent>
                      Chargeback and angry-customer cases are always handled by a human, so autonomy stays at 0%.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={form.autonomy_pct}
                  onValueChange={(v) =>
                    update({ autonomy_pct: typeof v === 'number' ? v : 0 })
                  }
                  disabled={!canEdit}
                  className="flex-1"
                />
                <span className="text-sm tabular-nums w-10 text-right text-foreground">
                  {form.autonomy_pct}%
                </span>
              </div>
            )}
          </SettingsField>

          <SettingsToggle
            id={`sc-${meta.key}-enabled`}
            label="Enabled"
            description="Let the agent use this scenario when matching tickets arrive."
            checked={form.enabled}
            onCheckedChange={(checked) => update({ enabled: checked })}
            disabled={!canEdit}
          />

          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} disabled={!isDirty || saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
