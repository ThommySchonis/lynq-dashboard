'use client'

export function TypingDots() {
  return (
    <div className="flex items-center gap-[5px] py-[3px]">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="size-1.5 rounded-full bg-gray-400"
          style={{ animation: `dotBounce 1.2s ease-in-out ${i * 0.18}s infinite` }}
        />
      ))}
    </div>
  )
}
