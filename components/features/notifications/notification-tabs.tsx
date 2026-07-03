'use client'

import { cn } from '@/lib/utils'
import { NOTIFICATION_TABS } from '@/lib/notification-constants'

/**
 * Filter tab bar for the notifications modal (Figma 355-5757). Data-driven from
 * NOTIFICATION_TABS — the six inbox placeholder tabs resolve to an empty state,
 * Broadcasts/Emma filter the two real categories. Horizontally scrollable since
 * the full set exceeds the 700px panel width.
 */
export function NotificationTabs({
  activeKey,
  onSelect,
}: {
  activeKey: string
  onSelect: (key: string) => void
}) {
  return (
    <div
      role="tablist"
      className="thin-scrollbar flex shrink-0 items-center gap-[13px] overflow-x-auto border-b border-border bg-surface-tabbar px-4 py-3"
    >
      {NOTIFICATION_TABS.map((tab) => {
        const Icon = tab.icon
        const active = tab.key === activeKey
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.key)}
            className={cn(
              'flex shrink-0 items-center gap-[5px] text-xs transition-colors',
              active
                ? 'font-semibold text-foreground'
                : 'font-medium text-foreground-3 hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
