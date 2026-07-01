interface FeedSkeletonProps {
  delay?: number
}

/** Loading placeholder shaped like an ArticleRow. */
export function FeedSkeleton({ delay = 0 }: FeedSkeletonProps) {
  return (
    <div
      className="opacity-0 animate-fade-up-quick motion-reduce:opacity-100 motion-reduce:animate-none flex items-stretch gap-[18px] rounded-[20px] border border-border bg-card py-3.5 pl-5 pr-6 shadow-[0_12px_32px_rgba(28,15,54,0.07)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="size-[92px] shrink-0 rounded-[14px] bg-muted" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-4 w-[70%] rounded bg-muted" />
        <div className="h-3.5 w-full rounded bg-muted" />
        <div className="mt-auto flex justify-between">
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
