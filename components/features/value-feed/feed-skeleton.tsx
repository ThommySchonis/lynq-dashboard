interface FeedSkeletonProps {
  delay?: number
}

export function FeedSkeleton({ delay = 0 }: FeedSkeletonProps) {
  return (
    <div
      className="vf-fade flex flex-col gap-3.5 rounded-2xl border border-[rgba(10,6,18,0.08)] bg-white p-8 shadow-[0_1px_2px_rgba(10,6,18,0.03)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <div className="h-3 w-[60px] rounded bg-[#F5F4F0]" />
        <div className="h-3 w-20 rounded bg-[#F5F4F0]" />
      </div>
      <div className="h-6 w-[70%] rounded bg-[#F5F4F0]" />
      <div className="h-3.5 w-full rounded bg-[#F5F4F0]" />
      <div className="h-3.5 w-[60%] rounded bg-[#F5F4F0]" />
    </div>
  )
}
