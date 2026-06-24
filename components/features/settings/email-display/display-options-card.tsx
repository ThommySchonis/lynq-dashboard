'use client'

import { Switch } from '@/components/ui/switch'
import { EmailDisplayCard, EmailDisplayToggleRow } from './email-display-card'

interface DisplayOptionsCardProps {
  showAgentName: boolean
  poweredByFooter: boolean
  onChange: (updates: { showAgentName?: boolean; poweredByFooter?: boolean }) => void
  disabled?: boolean
}

export function DisplayOptionsCard({
  showAgentName,
  poweredByFooter,
  onChange,
  disabled,
}: DisplayOptionsCardProps) {
  return (
    <EmailDisplayCard title="Display options">
      <div className="flex flex-col">
        <EmailDisplayToggleRow
          divided={false}
          title="Show agent name to customers"
          description="Replies show the agent's first name instead of a generic alias."
          control={
            <Switch
              checked={showAgentName}
              onCheckedChange={(v) => onChange({ showAgentName: v })}
              disabled={disabled}
            />
          }
        />
        <EmailDisplayToggleRow
          title="Include “Powered by Lynq & Flow” footer"
          description="Hidden on paid plans for full white-labeling."
          control={
            <Switch
              checked={poweredByFooter}
              onCheckedChange={(v) => onChange({ poweredByFooter: v })}
              disabled={disabled}
            />
          }
        />
      </div>
    </EmailDisplayCard>
  )
}
