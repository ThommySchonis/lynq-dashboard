'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth'
import { ADMIN_EMAILS } from '@/lib/admin-constants'
import { AdminSidebar } from '@/components/features/admin/admin-sidebar'
import { AdminTopbar } from '@/components/features/admin/admin-topbar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  const redirected = useRef(false)

  useEffect(() => {
    if (isLoading || redirected.current) return
    if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
      redirected.current = true
      window.location.href = '/admin/login'
    }
  }, [user, isLoading])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9F9FB] flex items-center justify-center text-[13px] text-muted-foreground font-sans">
        Checking access…
      </div>
    )
  }

  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return null
  }

  return (
    <div className="flex h-screen bg-[#F9F9FB] overflow-hidden font-sans">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar />
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
