'use client'

import { useState } from 'react'
import { Loader2, AlertCircle, X } from 'lucide-react'
import type { TimeFilter, TeamData, Session } from '@/types/time-tracking'
import { useAuthStore } from '@/stores/auth'
import { useTimeData } from '@/hooks/time-tracking/use-time-tracking-data'
import { useTimeClock } from '@/hooks/time-tracking/use-time-clock'
import { TrackingHeader } from './tracking-header'
import { ClockOutModal } from './clock-out-modal'
import { TeamView } from './team-view'
import { PersonalView } from './personal-view'

export function TimeTrackingPage() {
  const [filter, setFilter] = useState<TimeFilter>('week')
  const myUid = useAuthStore((s) => s.user?.id ?? null)
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const { data, isPending, isError } = useTimeData(filter)

  // The logged-in user's own active session. The employee branch returns it
  // directly; the admin branch only returns the full sessions list, so locate
  // our own still-open session by agent_id.
  const activeSession: Session | null =
    data?.active_session ??
    data?.sessions?.find((s) => s.agent_id === myUid && !s.clocked_out_at) ??
    null

  const clock = useTimeClock(activeSession)

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-foreground" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center text-[13px] text-foreground-3">
          Your account is not set up for time tracking. Ask your admin to add you as a team member.
        </div>
      </main>
    )
  }

  const showTeam = !!data.is_admin || !!data.is_client_admin

  const title = showTeam ? 'Team Time Tracking' : 'Time Tracking'
  const subtitle = showTeam
    ? `${data.client?.company_name ?? 'All clients'} · ${(data.active_count ?? 0) + (data.paused_count ?? 0)} active now`
    : 'Track your daily work hours'

  return (
    <main className="min-h-screen overflow-y-auto px-10 pt-9 pb-12">
      <div className="mx-auto max-w-[1170px] space-y-6">
        <TrackingHeader title={title} subtitle={subtitle} clock={clock} shiftTargetSec={data.shift_target_seconds} disabled={isSuspended} />

        {clock.error && (
          <div className="flex items-center gap-2.5 rounded-lg border border-destructive/15 bg-destructive-soft px-3.5 py-2.5 text-[13px] font-medium text-destructive animate-fade-up">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {clock.error}
            <button onClick={clock.clearError} className="ml-auto bg-transparent text-inherit opacity-60">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {showTeam ? (
          <TeamView data={data as TeamData} filter={filter} onFilterChange={setFilter} />
        ) : (
          <PersonalView
            sessions={data.sessions ?? []}
            todaySeconds={data.today_seconds ?? 0}
            filter={filter}
            onFilterChange={setFilter}
            isActive={clock.isActive}
            elapsed={clock.elapsed}
          />
        )}
      </div>

      {clock.showModal && activeSession && (
        <ClockOutModal
          session={activeSession}
          elapsedSec={clock.elapsed}
          pausedSeconds={clock.pausedSec}
          onConfirm={clock.clockOut}
          onCancel={clock.closeModal}
          submitting={clock.submitting}
        />
      )}
    </main>
  )
}
