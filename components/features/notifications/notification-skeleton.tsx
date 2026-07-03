/** Loading placeholder shaped like a notification row (badge + two text lines). */
export function NotificationSkeleton() {
  return (
    <div aria-hidden className="py-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-[13px] py-3.5 pr-4 pl-[18px]">
          <div className="size-[38px] shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  )
}
