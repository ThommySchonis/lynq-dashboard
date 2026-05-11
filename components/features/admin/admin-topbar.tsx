'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TAB_META } from '@/lib/admin-constants'
import { supabase } from '@/lib/supabase'
import {
  useClients,
  useBroadcasts,
  useNotifications,
  useInquiries,
  useTeamMembers,
  useMasterclasses,
} from '@/hooks/admin'

/* ------------------------------------------------------------------ */
/*  Dynamic subtitle sub-components — each one isolates its own query */
/* ------------------------------------------------------------------ */

function ClientsSub() {
  const { data } = useClients()
  return <>{data?.length ?? 0} total</>
}

function BroadcastsSub() {
  const { data } = useBroadcasts()
  return <>{data?.length ?? 0} total</>
}

function NotificationsSub() {
  const { data } = useNotifications()
  return <>{data?.length ?? 0} total</>
}

function InquiriesSub() {
  const { data } = useInquiries()
  const newCount = data?.filter((i) => i.status === 'new').length ?? 0
  return <>{newCount} new</>
}

function TeamSub() {
  const { data } = useTeamMembers()
  return <>{data?.length ?? 0} members</>
}

function EventsSub() {
  const { data } = useMasterclasses()
  return <>{data?.length ?? 0} scheduled</>
}

const DYNAMIC_SUB: Record<string, () => React.JSX.Element> = {
  clients: ClientsSub,
  broadcasts: BroadcastsSub,
  notifications: NotificationsSub,
  inquiries: InquiriesSub,
  team: TeamSub,
  events: EventsSub,
}

/* ------------------------------------------------------------------ */
/*  Topbar                                                            */
/* ------------------------------------------------------------------ */

function deriveSegment(pathname: string): string {
  // /admin/clients → "clients", /admin/dashboard → "dashboard"
  const parts = pathname.replace(/\/$/, '').split('/')
  return parts[parts.length - 1] || 'dashboard'
}

export function AdminTopbar() {
  const pathname = usePathname() ?? ''
  const router = useRouter()

  const segment = deriveSegment(pathname)
  const meta = TAB_META[segment] ?? { title: segment.charAt(0).toUpperCase() + segment.slice(1), sub: null }

  const DynamicSub = meta.sub === null ? DYNAMIC_SUB[segment] ?? null : null

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{meta.title}</h1>
        <p className="text-sm text-gray-500">
          {meta.sub ?? (DynamicSub ? <DynamicSub /> : null)}
        </p>
      </div>

      <Button variant="outline" size="sm" onClick={handleLogout}>
        <LogOut size={14} strokeWidth={1.75} className="mr-1.5" />
        Logout
      </Button>
    </header>
  )
}

export default AdminTopbar
