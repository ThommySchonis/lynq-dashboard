import { WidgetShell } from './widget-shell'
import type { SidebarEvent } from '@/hooks/value-feed'

/** Sidebar "Upcoming Events" widget (Figma 396:8090) — from masterclasses. */
export function WidgetUpcomingEvents({ events }: { events: SidebarEvent[] }) {
  return (
    <WidgetShell title="Upcoming Events" action="See all">
      {events.length === 0 ? (
        <p className="text-xs leading-4 text-foreground-4">No upcoming events.</p>
      ) : (
      <div className="flex flex-col gap-3.5">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-3">
            <div className="flex size-[46px] shrink-0 flex-col items-center justify-center gap-px rounded-xl bg-accent-soft py-1.5">
              <span className="text-xs font-semibold uppercase leading-[14px] tracking-[0.08em] text-primary">
                {e.month}
              </span>
              <span className="text-xs font-medium leading-4 text-foreground">{e.day}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-px">
              <span className="line-clamp-1 text-sm font-medium leading-5 text-foreground">{e.title}</span>
              <span className="text-xs leading-4 text-foreground-4">{e.timeText}</span>
            </div>
          </div>
        ))}
      </div>
      )}
    </WidgetShell>
  )
}
