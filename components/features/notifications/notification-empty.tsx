import { Check } from 'lucide-react'

/** Pixel-perfect empty state for the notifications modal (Figma 350-5474). */
export function NotificationEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
      <span className="flex size-11 items-center justify-center rounded-[11px] bg-accent-soft">
        <Check className="size-[18px] text-primary" strokeWidth={1.75} />
      </span>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-base leading-[22px] font-semibold text-foreground">
          You&rsquo;re all caught up
        </p>
        <p className="text-sm text-foreground-3">No unread notifications right now</p>
      </div>
    </div>
  )
}
