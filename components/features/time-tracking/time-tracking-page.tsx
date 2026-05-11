'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'
import type { TimeFilter, TeamData } from '@/types/time-tracking'
import { useTimeData } from '@/hooks/time-tracking/use-time-tracking-data'
import { TeamView } from './team-view'
import { PersonalView } from './personal-view'

export function TimeTrackingPage() {
  const [filter, setFilter] = useState<TimeFilter>('week')
  const { data, isPending, isError } = useTimeData(filter)

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[--bg-page]">
        <Loader2 className="h-7 w-7 animate-spin text-[#0F0F10]" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen bg-[--bg-page]">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="text-center text-[13px] text-gray-500">
            Your account is not set up for time tracking. Ask your admin to add you as a team member.
          </div>
        </main>
      </div>
    )
  }

  const isAdmin = !!data.is_admin
  const isClientAdmin = !!data.is_client_admin

  return (
    <div className="flex min-h-screen bg-[--bg-page]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto" style={{ maxWidth: (isAdmin || isClientAdmin) ? 1100 : 860 }}>
          {(isAdmin || isClientAdmin) ? (
            <TeamView data={data as TeamData} filter={filter} onFilterChange={setFilter} />
          ) : (
            <PersonalView
              isAdmin={isAdmin}
              sessions={data.sessions ?? []}
              activeSession={data.active_session ?? null}
              todaySeconds={data.today_seconds ?? 0}
              filter={filter}
              onFilterChange={setFilter}
            />
          )}
        </div>
      </main>
    </div>
  )
}
