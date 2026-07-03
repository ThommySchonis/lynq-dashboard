import { Skeleton } from '@/components/ui/skeleton'

/** Loading placeholder shaped like a notification row (badge + two text lines). */
export function NotificationSkeleton() {
  return (
    <div aria-hidden className="py-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-[13px] py-3.5 pr-4 pl-[18px]">
          <Skeleton className="size-[38px] shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
