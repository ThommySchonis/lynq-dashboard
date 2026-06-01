'use client'

import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { StatusBadge } from '@/components/features/settings/status-badge'
import type { AiScenarioRow } from '@/hooks/ai'
import { CANONICAL_SCENARIOS } from '@/lib/constants/emma-onboarding'
import { ScenarioRow } from './scenario-row'

export interface ScenarioMeta {
  key: string
  title: string
  /** angry_or_chargeback is always human-handled — autonomy is locked at 0%. */
  lockAutonomy?: boolean
}

// 8 canonical scenarios post Emma onboarding refactor. The authoritative
// list lives in lib/constants/emma-onboarding.ts (CANONICAL_SCENARIOS) so
// the prompt builder, the autonomy gate, the rules-settings UI, and this
// section all share one source. SCENARIOS is re-exported for the small
// number of legacy importers that still reach for it from this path.
export const SCENARIOS: ScenarioMeta[] = CANONICAL_SCENARIOS

interface ScenariosSectionProps {
  storeId: string
  scenarios: AiScenarioRow[]
  canEdit: boolean
  isComplete: boolean
}

export function ScenariosSection({ storeId, scenarios, canEdit, isComplete }: ScenariosSectionProps) {
  return (
    <SettingsSection
      title="Scenarios"
      description="How the AI agent approaches each common support situation. Each scenario saves on its own."
      actions={
        <StatusBadge
          status={isComplete ? 'active' : 'pending'}
          label={isComplete ? 'Complete' : 'Incomplete'}
        />
      }
    >
      <SettingsCard>
        <div className="flex flex-col divide-y divide-border">
          {SCENARIOS.map((meta, i) => (
            <ScenarioRow
              key={meta.key}
              meta={meta}
              storeId={storeId}
              canEdit={canEdit}
              row={scenarios.find((r) => r.scenario_key === meta.key)}
              first={i === 0}
              last={i === SCENARIOS.length - 1}
            />
          ))}
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
