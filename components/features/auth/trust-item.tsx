'use client'

import type { TrustItem as TrustItemType } from '@/lib/auth-constants'

interface TrustItemProps {
  item: TrustItemType
}

export function TrustItem({ item }: TrustItemProps) {
  const Icon = item.icon
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} strokeWidth={2.5} />
      {item.text}
    </span>
  )
}
