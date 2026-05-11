'use client'

import { getInitials } from '@/lib/inbox-utils'

interface ComposeAvatarProps {
  name?: string
  size?: number
}

export function ComposeAvatar({ name = '?', size = 28 }: ComposeAvatarProps) {
  const initials = getInitials(name)
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      <span className="font-bold tracking-tight">{initials}</span>
    </div>
  )
}
