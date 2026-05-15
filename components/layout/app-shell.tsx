'use client'

import { useState } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Sidebar } from './sidebar'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

interface AppShellProps {
  children: React.ReactNode
}

// Iter 2: sidebar is edge-to-edge (no longer floating) at w-16 (collapsed)
// → w-56 on hover. Content margin is constant `ml-16` (64px) so it sits
// flush against the collapsed sidebar; the sidebar overlays the content
// when it expands, no layout shift.
export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 767px)')

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="fixed left-3 top-3 z-40"
              />
            }
          >
            <Menu size={20} />
          </SheetTrigger>
          <SheetContent side="left" className="w-[224px] p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar />
          </SheetContent>
        </Sheet>
        <main className="min-h-screen">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="min-h-screen ml-16">
        {children}
      </main>
    </div>
  )
}
