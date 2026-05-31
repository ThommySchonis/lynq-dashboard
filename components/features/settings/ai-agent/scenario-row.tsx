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
import { ChipInput } from '@/components/shared/chip-input'
import { useUpsertAiScenario } from '@/hooks/ai'
import type { AiScenarioRow } from '@/hooks/ai'
import type { ScenarioMeta } from './scenarios-section'

interface ScenarioForm {
  approach: string
  questions_to_ask: string[]
  response_template: string
  escalate_when: string
  autonomy_pct: number
  enabled: boolean
}

function rowToForm(row: AiScenarioRow | undefined): ScenarioForm {
  return {
    approach: row?.approach ?? '',
    questions_to_ask: row?.questions_to_ask ?? [],
    response_template: row?.response_template ?? '',
    escalate_when: row?.escalate_when ?? '',
    autonomy_pct: row?.autonomy_pct ?? 0,
    enabled: row?.enabled ?? true,
  }
}

const sameList = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)

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

  // A scenario counts as complete once it has at least an approach + escalate_when.
  const complete = !!(form.approach.trim() && form.escalate_when.trim())

  const isDirty =
    form.approach !== init.approach ||
    form.response_template !== init.response_template ||
    form.escalate_when !== init.escalate_when ||
    form.autonomy_pct !== init.autonomy_pct ||
    form.enabled !== init.enabled ||
    !sameList(form.questions_to_ask, init.questions_to_ask)

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    try {
      const payload: ScenarioForm = { ...form, autonomy_pct: locked ? 0 : form.autonomy_pct }
      await upsert.mutateAsync({
        scenario_key: meta.key,
        title: meta.title,
        approach: payload.approach,
        questions_to_ask: payload.questions_to_ask,
        response_template: payload.response_template,
        escalate_when: payload.escalate_when,
        autonomy_pct: payload.autonomy_pct,
        enabled: payload.enabled,
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
            label="Approach"
            htmlFor={`sc-${meta.key}-approach`}
            hint="How the agent should handle this situation."
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
            label="Questions to ask"
            hint="Information the agent should gather first. Type and press Enter."
          >
            <ChipInput
              value={form.questions_to_ask}
              onChange={(questions_to_ask) => update({ questions_to_ask })}
              placeholder="e.g. Order number…"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField
            label="Response template"
            htmlFor={`sc-${meta.key}-template`}
            hint="An optional starting point for the reply."
          >
            <Textarea
              id={`sc-${meta.key}-template`}
              value={form.response_template}
              onChange={(e) => update({ response_template: e.target.value })}
              placeholder="Hi {name}, thanks for reaching out…"
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
              placeholder="e.g. Customer threatens a chargeback…"
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
