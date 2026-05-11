'use client'

export function CarrierBadge({ name, logoUrl }: { name?: string; logoUrl?: string }) {
  if (!name) return <span className="text-xs text-(--text-3)">{'\u2014'}</span>
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-lg bg-(--bg-surface-2) border border-(--border) text-xs text-(--text-2) font-medium">
      {logoUrl && (
        <img src={logoUrl} alt={name} className="h-[13px] object-contain opacity-55" />
      )}
      {name}
    </span>
  )
}
