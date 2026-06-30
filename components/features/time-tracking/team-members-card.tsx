'use client'

import { Clock } from 'lucide-react'
import type { TeamMember } from '@/types/time-tracking'
import { MemberRow } from './member-row'

interface TeamMembersCardProps {
  members: TeamMember[]
}

export function TeamMembersCard({ members }: TeamMembersCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card animate-fade-up">
      <div className="px-[22px] pt-5 pb-[18px]">
        <div className="text-base font-semibold text-foreground">Team Members</div>
        <div className="mt-[3px] text-sm text-foreground-3">Status and hours per member this period</div>
      </div>
      <div className="border-t border-border">
        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-[22px] py-14">
            <Clock className="h-10 w-10 text-foreground-4" strokeWidth={1.5} />
            <div className="mt-2 text-base font-semibold text-foreground">No team members</div>
            <div className="text-sm text-foreground-3">Add team members via the admin panel.</div>
          </div>
        ) : (
          members.map((m) => <MemberRow key={m.id} member={m} />)
        )}
      </div>
    </div>
  )
}
