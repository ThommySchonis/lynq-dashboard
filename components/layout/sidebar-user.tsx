'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Moon, Sun } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarUserProps {
  collapsed?: boolean
}

export function SidebarUser({ collapsed }: SidebarUserProps) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const workspace = useAuthStore((s) => s.workspace)
  const { theme, toggle } = useThemeStore()

  const displayName = workspace?.name || user?.email?.split('@')[0] || 'User'
  const initials = displayName.slice(0, 2).toUpperCase()
  const email = user?.email || ''

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-gradient-to-br from-primary to-purple-700 text-white text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="h-7 w-7 text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="h-7 w-7 text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
          aria-label="Log out"
        >
          <LogOut size={14} />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-primary to-purple-700 text-white text-xs font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="truncate text-sm font-medium text-white/80">
          {displayName}
        </p>
        <p className="truncate text-xs text-white/50">
          {email}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        className="h-7 w-7 shrink-0 text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        className="h-7 w-7 shrink-0 text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
        aria-label="Log out"
      >
        <LogOut size={14} />
      </Button>
    </div>
  )
}
