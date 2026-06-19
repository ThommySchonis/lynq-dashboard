'use client'

export function TypingDots() {
  return (
    <div className="flex items-center gap-[5px] py-[3px]">
      <div className="size-1.5 rounded-full bg-foreground-4 animate-dot-bounce" />
      <div className="size-1.5 rounded-full bg-foreground-4 animate-dot-bounce [animation-delay:0.18s]" />
      <div className="size-1.5 rounded-full bg-foreground-4 animate-dot-bounce [animation-delay:0.36s]" />
    </div>
  )
}
