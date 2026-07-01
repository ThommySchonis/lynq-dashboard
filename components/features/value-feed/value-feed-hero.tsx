/**
 * Value Feed page header — title + subtitle (Figma "title" node 396:8053).
 */
export function ValueFeedHero() {
  return (
    <header className="flex min-h-[54px] w-full items-center justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-bold leading-[30px] tracking-[-0.01em] text-foreground">
          Value Feed
        </h1>
        <p className="text-sm leading-5 text-foreground-3">
          Tips, masterclasses, and updates from Lynq &amp; Flow.
        </p>
      </div>
    </header>
  )
}
