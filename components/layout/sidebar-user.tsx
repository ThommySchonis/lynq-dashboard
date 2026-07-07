'use client'

import { useRouter } from 'next/navigation'
import { LogOut /*, Moon, Sun */ } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
// import { useThemeStore } from '@/stores/theme' // Theme switching temporarily disabled — restore to re-enable
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

interface SidebarUserProps {
  collapsed?: boolean
}

export function SidebarUser({ collapsed }: SidebarUserProps) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const workspace = useAuthStore((s) => s.workspace)
  // Theme switching temporarily disabled — light mode only. Restore to re-enable.
  // const theme = useThemeStore((s) => s.theme)
  // const toggle = useThemeStore((s) => s.toggle)

  const displayName = workspace?.name || user?.email?.split('@')[0] || 'User'
  const initials = displayName.slice(0, 2).toUpperCase()
  const email = user?.email || ''

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // const themeLabel = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
  // const ThemeIcon = theme === 'light' ? Moon : Sun

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        {/* Theme switching temporarily disabled — light mode only. Restore to re-enable.
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="size-7 text-foreground-3 hover:text-foreground"
          aria-label={themeLabel}
        >
          <ThemeIcon size={14} />
        </Button>
        */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void handleLogout()}
          className="size-7 text-foreground-3 hover:text-foreground"
          aria-label="Log out"
        >
          <LogOut size={14} />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-[9px] px-2 py-2">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
        <p className="truncate text-xs text-foreground-3">{email}</p>
      </div>
      {/* Theme switching temporarily disabled — light mode only. Restore to re-enable.
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        className="size-7 shrink-0 text-foreground-3 hover:text-foreground"
        aria-label={themeLabel}
      >
        <ThemeIcon size={14} />
      </Button>
      */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void handleLogout()}
        className="size-7 shrink-0 text-foreground-3 hover:text-foreground"
        aria-label="Log out"
      >
        <LogOut size={14} />
      </Button>
    </div>
  )
}
