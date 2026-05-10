'use client'

import { Users, UserCheck, Radio, Bell } from 'lucide-react'
import { useClients, useBroadcasts, useNotifications } from '@/hooks/admin'
import { MetricCard } from './metric-card'
import { RecentClientsList } from './recent-clients-list'

export function DashboardView() {
  const { data: clients = [] } = useClients()
  const { data: broadcasts = [] } = useBroadcasts()
  const { data: notifications = [] } = useNotifications()

  const activeClients = clients.filter((c) => c.status === 'active').length

  return (
    <div>
      <div className="mb-6 grid grid-cols-4 gap-3">
        <MetricCard icon={Users} value={clients.length} label="Total Clients" />
        <MetricCard icon={UserCheck} value={activeClients} label="Active Clients" />
        <MetricCard icon={Radio} value={broadcasts.length} label="Broadcasts" />
        <MetricCard icon={Bell} value={notifications.length} label="Notifications" />
      </div>
      <RecentClientsList />
    </div>
  )
}
