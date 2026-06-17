'use client'

import { cloneElement, isValidElement, type ReactElement } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { usePermissions } from '@/hooks/use-permissions'
import type { can } from '@/lib/permissions'

type Capability = keyof typeof can

interface GateProps {
  capability: Capability
  /** 'hide' removes the child entirely; 'disable' renders it disabled with a tooltip. */
  mode?: 'hide' | 'disable'
  reason?: string
  children: ReactElement
}

/**
 * Renders children only when the current role has `capability`.
 * - mode="hide": returns null when denied (use for nav items / whole sections).
 * - mode="disable": clones the child with `disabled` and wraps it in a tooltip
 *   explaining why (use for inline action buttons).
 */
export function Gate({
  capability,
  mode = 'hide',
  reason = 'View-only access — ask an admin to make changes.',
  children,
}: GateProps) {
  const { can: allowed } = usePermissions()

  if (allowed[capability]) return children
  if (mode === 'hide') return null

  const disabledChild = isValidElement(children)
    ? cloneElement(children as ReactElement<{ disabled?: boolean }>, { disabled: true })
    : children

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex cursor-not-allowed" />}>
        {disabledChild}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}
