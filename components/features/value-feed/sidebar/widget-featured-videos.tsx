import { Play } from 'lucide-react'
import { WidgetShell } from './widget-shell'
import type { SidebarVideo } from '@/hooks/value-feed'

/** Sidebar "Featured Videos" widget (Figma 396:8118) — broadcasts w/ youtube. */
export function WidgetFeaturedVideos({ videos }: { videos: SidebarVideo[] }) {
  return (
    <WidgetShell title="Featured Videos" action="Browse">
      {videos.length === 0 ? (
        <p className="text-xs leading-4 text-foreground-4">No videos yet.</p>
      ) : (
      <div className="flex flex-col gap-3.5">
        {videos.map((v) => (
          <a
            key={v.id}
            href={v.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3"
          >
            {/* Thumb (Figma node 404:827) */}
            <div className="relative flex h-[52px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[linear-gradient(109deg,#EDE6FF_0%,#FDFCFF_76%)]">
              <span aria-hidden="true" className="absolute left-[6px] top-[26px] size-[22px] rounded-full border-[1.5px] border-[#8B5CF6]/40" />
              <span aria-hidden="true" className="absolute left-[42px] top-[6px] size-[46px] rounded-full bg-[#C4A0FF]/50" />
              <span className="relative flex size-7 items-center justify-center rounded-full bg-white/95 shadow-sm">
                <Play className="size-[13px] translate-x-px fill-primary text-primary" strokeWidth={0} />
              </span>
            </div>
            <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-foreground transition-colors group-hover:text-primary">
              {v.title}
            </span>
          </a>
        ))}
      </div>
      )}
    </WidgetShell>
  )
}
