'use client'

import type { ReactNode } from 'react'
import AdminSidebar from '../../components/features/admin/admin-sidebar'

// Shell for /lynq-admin/* routes — mirrors the admin panel shell at /admin
// so the two feel like one cohesive surface. The sidebar runs in link-mode
// (no onTabChange prop): clicking a tab navigates to /admin?tab=<id> and
// the AdminPage's useSearchParams effect opens the right tab.
//
// SUPPORT > Feedback is a real route, so its active state highlights based
// on pathname while we're inside /lynq-admin/feedback.

interface LynqAdminLayoutProps {
  children: ReactNode
}

export default function LynqAdminLayout({ children }: LynqAdminLayoutProps) {
  return (
    <div className="flex h-screen bg-[#F9F9FB] overflow-hidden antialiased">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  )
}
