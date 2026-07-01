import { WidgetShell } from './widget-shell'
import type { SidebarPopularItem } from '@/hooks/value-feed'

/**
 * Sidebar "Popular this week" widget (Figma 396:8160). Top-N by recency — no
 * real read counts exist, so the subtitle shows the kind only (see plan).
 */
export function WidgetPopular({ items }: { items: SidebarPopularItem[] }) {
  return (
    <WidgetShell title="Popular this week">
      <div className="flex flex-col gap-4">
        {items.map((it, i) => (
          <div key={it.id} className="flex gap-3">
            <span className="text-sm font-semibold leading-5 text-[#DBD6F2]">{i + 1}</span>
            <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
              <span className="line-clamp-2 text-sm font-medium leading-5 text-foreground">{it.title}</span>
              <span className="text-xs leading-4 text-foreground-4">{it.kindLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  )
}
