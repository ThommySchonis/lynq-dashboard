'use client'

import { useValueFeedSidebar } from '@/hooks/value-feed'
import { WidgetUpcomingEvents } from './widget-upcoming-events'
import { WidgetFeaturedVideos } from './widget-featured-videos'
import { WidgetPopular } from './widget-popular'
import { WidgetNewsletter } from './widget-newsletter'

/** Value Feed sidebar column (Figma node 395:795) — 340px, gap 20. */
export function ValueFeedSidebar() {
  const { events, videos, popular } = useValueFeedSidebar()

  return (
    <aside className="hidden w-[340px] shrink-0 flex-col gap-5 lg:flex">
      <WidgetUpcomingEvents events={events} />
      <WidgetFeaturedVideos videos={videos} />
      {popular.length > 0 && <WidgetPopular items={popular} />}
      <WidgetNewsletter />
    </aside>
  )
}
