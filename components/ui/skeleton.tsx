import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-[length:400px_100%] bg-[linear-gradient(90deg,var(--skeleton-from)_0%,var(--skeleton-to)_50%,var(--skeleton-from)_100%)] bg-no-repeat animate-shimmer motion-reduce:animate-pulse motion-reduce:bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
