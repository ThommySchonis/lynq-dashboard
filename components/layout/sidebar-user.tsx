'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Moon, Sun } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--sidebar-hover)]',
              collapsed && 'justify-center px-2',
            )}
          />
        }
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-gradient-to-br from-primary to-purple-700 text-white text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-[var(--sidebar-label-active)]">
              {displayName}
            </p>
            <p className="truncate text-xs text-[var(--sidebar-label-inactive)]">
              {email}
            </p>
          </div>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuItem onClick={toggle}>
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut size={16} />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
