'use client'

import { useEffect, useState } from 'react'
import { useUIStore } from '@/stores/ui'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isMobile = useMediaQuery('(max-width: 767px)')

  useEffect(() => {
    if (isTablet) setSidebarCollapsed(true)
  }, [isTablet, setSidebarCollapsed])

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
          <SheetContent side="left" className="w-[208px] p-0">
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
      <main
        className={cn(
          'min-h-screen transition-[margin-left] duration-200',
          collapsed ? 'ml-[60px]' : 'ml-[208px]',
        )}
      >
        {children}
      </main>
    </div>
  )
}
