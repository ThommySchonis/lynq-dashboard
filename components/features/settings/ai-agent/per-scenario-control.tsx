'use client'

import { Switch } from '@/components/ui/switch'
import { useAiScenarios } from '@/hooks/ai'
import type { AiScenarioRow } from '@/hooks/ai/use-ai-policies-data'
import type { ReplyIntent } from '@/lib/schemas/ai'
import { SCENARIOS } from './scenarios-section'

interface ScenarioRowProps {
  title: string
  autoSend: boolean
  needsTraining: boolean
  first: boolean
  onToggle: (autoSend: boolean) => void
  disabled?: boolean
}

/** One scenario row (Figma node 1068-112 …). */
function ScenarioRow({ title, autoSend, needsTraining, first, onToggle, disabled }: ScenarioRowProps) {
  const on = autoSend && !needsTraining
  return (
    <div
      className={`flex items-center justify-between px-5 py-[15px] ${
        first ? '' : 'border-t border-settings-border'
      }`}
    >
      <div className="flex items-center gap-[9px]">
        <span className={`text-sm font-semibold ${needsTraining ? 'text-muted-foreground' : 'text-foreground'}`}>
          {title}
        </span>
        {needsTraining && (
          <span className="flex items-center gap-[5px] rounded-full bg-warning-soft py-[3px] pr-[9px] pl-2">
            <span className="size-1.5 rounded-full bg-warning" />
            <span className="text-xs font-semibold text-[#B45309]">Needs training</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <span className={`text-xs font-semibold ${on ? 'text-primary-hover' : 'text-muted-foreground'}`}>
          {on ? 'Auto-send' : 'Review only'}
        </span>
        <Switch
          size="lg"
          checked={on}
          onCheckedChange={onToggle}
          disabled={disabled || needsTraining}
          className="data-unchecked:bg-[#D8DADE]"
          aria-label={`Auto-send for ${title}`}
        />
      </div>
    </div>
  )
}

/** A scenario is trained once it has both an approach and an escalate-when rule. */
function isTrained(row: AiScenarioRow | undefined): boolean {
  return !!(row?.approach?.trim() && row?.escalate_when?.trim())
}

interface PerScenarioControlProps {
  storeId: string
  blockedIntents: ReplyIntent[]
  onToggle: (intent: ReplyIntent, autoSend: boolean) => void
  disabled?: boolean
}

/**
 * Per-scenario auto-send overrides (Figma node 1068-108 … 168). Each of the 7
 * canonical scenarios maps 1:1 to a reply intent; the toggle reflects whether
 * that intent is NOT on the store's global block list. Untrained scenarios are
 * locked to review only.
 */
export function PerScenarioControl({ storeId, blockedIntents, onToggle, disabled }: PerScenarioControlProps) {
  const { data: scenarios } = useAiScenarios(storeId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-foreground">Per-scenario control</h2>
        <p className="text-sm font-medium text-muted-foreground">
          Override auto-send for individual scenarios. The conditions above still apply.
        </p>
      </div>

      <div className="flex flex-col rounded-2xl border border-settings-border bg-card">
        {SCENARIOS.map((meta, i) => {
          const intent = meta.key as ReplyIntent
          const needsTraining = !isTrained(scenarios?.find((r) => r.scenario_key === meta.key))
          return (
            <ScenarioRow
              key={meta.key}
              title={meta.title}
              autoSend={!blockedIntents.includes(intent)}
              needsTraining={needsTraining}
              first={i === 0}
              onToggle={(autoSend) => onToggle(intent, autoSend)}
              disabled={disabled}
            />
          )
        })}
      </div>
    </div>
  )
}
