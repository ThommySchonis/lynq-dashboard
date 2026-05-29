'use client'

import { useEffect, useRef } from 'react'
import { useOnboardingStatus } from '@/hooks/home/use-home-data'
import { AdminSidebar } from '@/components/features/admin/admin-sidebar'
import { AdminTopbar } from '@/components/features/admin/admin-topbar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useOnboardingStatus()
  const isAdmin = data?.is_platform_admin === true
  const redirected = useRef(false)

  useEffect(() => {
    if (isLoading || redirected.current) return
    if (!isAdmin) {
      redirected.current = true
      window.location.href = '/admin/login'
    }
  }, [isAdmin, isLoading])

  if (isLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#F9F9FB] flex items-center justify-center text-[13px] text-muted-foreground font-sans">
        Checking access…
      </div>
    )
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
