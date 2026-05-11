export function ConnectedBadge() {
  return (
    <div className="flex items-center gap-1.5 text-green-400 text-[13px] font-medium">
      <span className="w-[18px] h-[18px] rounded-full bg-green-400/15 flex items-center justify-center text-[10px]">
        ✓
      </span>
      Connected
    </div>
  )
}
