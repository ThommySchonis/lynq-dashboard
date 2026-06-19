'use client'

import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HomeHeaderProps {
  userName: string
}

export function HomeHeader({ userName }: HomeHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Hi, {userName || 'there'}!
      </h1>
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link href="/inbox" />}
      >
        <Inbox className="size-4" />
        Go to inbox
      </Button>
    </div>
  )
}
